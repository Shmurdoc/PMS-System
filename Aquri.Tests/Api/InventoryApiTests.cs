using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class InventoryApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public InventoryApiTests(AquriApiFactory factory) : base(factory) { }

        private static object ItemPayload(
            int propertyId = 1,
            string name = "Bath Towels",
            string category = "linen",
            int quantity = 40,
            int reorderLevel = 10,
            decimal price = 12m) =>
            new { propertyId, name, category, quantity, unit = "piece", reorderLevel, price, supplier = "Textile Co" };

        private async Task<int> CreateItemAsync(HttpClient client, object? payload = null)
        {
            var response = await client.PostAsync("/api/v1/inventoryitems", JsonBody(payload ?? ItemPayload()));
            response.StatusCode.Should().Be(HttpStatusCode.Created);
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        [Fact]
        public async Task Create_Returns_201_With_Computed_NeedsReorder()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/inventoryitems",
                JsonBody(ItemPayload(quantity: 5, reorderLevel: 10)));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("name").GetString().Should().Be("Bath Towels");
            envelope.GetProperty("data").GetProperty("needsReorder").GetBoolean().Should().BeTrue();
        }

        [Fact]
        public async Task Create_Invalid_Negative_Quantity_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/inventoryitems",
                JsonBody(ItemPayload(quantity: -1)));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Adjust_Negative_Delta_Below_Zero_Returns_400()
        {
            var client = await AdminClientAsync();
            var id = await CreateItemAsync(client, ItemPayload(quantity: 3));

            var response = await client.PostAsync($"/api/v1/inventoryitems/{id}/adjust",
                JsonBody(new { delta = -10 }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Restock_Bumps_Quantity_And_Stamps_LastRestocked()
        {
            var client = await AdminClientAsync();
            var id = await CreateItemAsync(client, ItemPayload(quantity: 8));

            var response = await client.PostAsync($"/api/v1/inventoryitems/{id}/restock",
                JsonBody(new { quantityAdded = 24 }));

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("quantity").GetInt32().Should().Be(32);
            envelope.GetProperty("data").GetProperty("lastRestocked").ValueKind.Should().NotBe(JsonValueKind.Null);
        }

        [Fact]
        public async Task Update_Then_Get_Shows_Changes()
        {
            var client = await AdminClientAsync();
            var id = await CreateItemAsync(client);

            var update = await client.PutAsync($"/api/v1/inventoryitems/{id}",
                JsonBody(new
                {
                    name = "Bath Towels (Egyptian)",
                    category = "linen",
                    unit = "piece",
                    reorderLevel = 20,
                    price = 15.5m,
                    supplier = "Textile Co",
                    location = "Linen closet B",
                    notes = "premium line"
                }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/inventoryitems/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("name").GetString().Should().Be("Bath Towels (Egyptian)");
            envelope.GetProperty("data").GetProperty("location").GetString().Should().Be("Linen closet B");
        }

        [Fact]
        public async Task List_Filters_By_Category()
        {
            var client = await AdminClientAsync();
            await CreateItemAsync(client, ItemPayload(name: "Linen Item", category: "linen"));
            await CreateItemAsync(client, ItemPayload(name: "Minibar Cola", category: "minibar"));

            var response = await client.GetAsync("/api/v1/inventoryitems?category=minibar");
            var envelope = await ParseAsync(response);
            var items = envelope.GetProperty("data").EnumerateArray().ToList();

            items.Should().Contain(i => i.GetProperty("name").GetString() == "Minibar Cola");
            items.Should().NotContain(i => i.GetProperty("name").GetString() == "Linen Item");
        }

        [Fact]
        public async Task FrontDesk_Cannot_Create_Or_Delete_But_Can_Read()
        {
            var client = await FrontDeskClientAsync();
            var admin = await AdminClientAsync();
            var id = await CreateItemAsync(admin);

            (await client.GetAsync("/api/v1/inventoryitems")).StatusCode.Should().Be(HttpStatusCode.OK);
            (await client.PostAsync("/api/v1/inventoryitems", JsonBody(ItemPayload(name: "Nope"))))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await client.DeleteAsync($"/api/v1/inventoryitems/{id}"))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Update_Sparse_Keeps_Omitted_Fields_And_Round_Tracks_Optionals()
        {
            var client = await AdminClientAsync();
            var id = await CreateItemAsync(client);

            var update = await client.PutAsync($"/api/v1/inventoryitems/{id}",
                JsonBody(new { name = "Renamed Towels" }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var envelope = await ParseAsync(await client.GetAsync($"/api/v1/inventoryitems/{id}"));
            var data = envelope.GetProperty("data");
            data.GetProperty("name").GetString().Should().Be("Renamed Towels");
            data.GetProperty("price").GetDecimal().Should().Be(12m);
            data.GetProperty("reorderLevel").GetInt32().Should().Be(10);
            data.GetProperty("unit").GetString().Should().Be("piece");
            data.GetProperty("supplier").GetString().Should().Be("Textile Co");
        }

        [Fact]
        public async Task Create_With_Sku_Expiry_MinOrder_Round_Trips()
        {
            var client = await AdminClientAsync();
            var expiry = new DateTime(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc);

            var response = await client.PostAsync("/api/v1/inventoryitems",
                JsonBody(new
                {
                    propertyId = 1, name = "Minibar Water", category = "minibar",
                    quantity = 60, unit = "bottle", reorderLevel = 12, price = 8.5m,
                    supplier = "Aqua Ltd", sku = "MB-WATER-500",
                    expiryDate = expiry, minOrderQuantity = 24
                }));
            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("sku").GetString().Should().Be("MB-WATER-500");
            envelope.GetProperty("data").GetProperty("minOrderQuantity").GetInt32().Should().Be(24);
            envelope.GetProperty("data").GetProperty("expiryDate").ValueKind.Should().NotBe(JsonValueKind.Null);
        }

        [Fact]
        public async Task Delete_Returns_204_With_Empty_Body_Then_404()
        {
            var client = await AdminClientAsync();
            var id = await CreateItemAsync(client);

            var delete = await client.DeleteAsync($"/api/v1/inventoryitems/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);
            (await delete.Content.ReadAsStringAsync()).Should().BeEmpty();

            (await client.GetAsync($"/api/v1/inventoryitems/{id}"))
                .StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
    }
}
