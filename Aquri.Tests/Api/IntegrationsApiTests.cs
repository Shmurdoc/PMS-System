using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class IntegrationsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public IntegrationsApiTests(AquriApiFactory factory) : base(factory) { }

        private static object IntegrationPayload(
            int propertyId = 1,
            string name = "Stripe Connect",
            string category = "payments") =>
            new
            {
                propertyId,
                name,
                category,
                description = "Accept card payments",
                icon = "💳",
                apiKey = "sk_test_placeholder",
                webhookUrl = "https://example.com/webhooks/stripe"
            };

        private async Task<int> CreateIntegrationAsync(HttpClient client, object? payload = null)
        {
            var response = await client.PostAsync("/api/v1/integrations", JsonBody(payload ?? IntegrationPayload()));
            response.StatusCode.Should().Be(HttpStatusCode.Created);
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        [Fact]
        public async Task Create_Returns_201_Disconnected_Stamped_With_Configurer()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/integrations",
                JsonBody(IntegrationPayload()));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data");
            data.GetProperty("name").GetString().Should().Be("Stripe Connect");
            data.GetProperty("status").GetString().Should().Be("disconnected");
            data.GetProperty("configuredBy").GetString().Should().Be("Admin User");
            data.GetProperty("lastSync").ValueKind.Should().Be(JsonValueKind.Null);
        }

        [Fact]
        public async Task Create_Missing_Name_Returns_400_VALIDATION()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/integrations",
                JsonBody(new { propertyId = 1, name = "", category = "payments" }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Sync_Stamps_LastSync_And_Flips_To_Connected()
        {
            var client = await AdminClientAsync();
            var id = await CreateIntegrationAsync(client);

            var response = await client.PostAsync($"/api/v1/integrations/{id}/sync", null);

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("status").GetString().Should().Be("connected");
            envelope.GetProperty("data").GetProperty("lastSync").ValueKind.Should().NotBe(JsonValueKind.Null);
        }

        [Fact]
        public async Task Sync_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/integrations/999999/sync", null);

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task List_Filters_By_Category()
        {
            var client = await AdminClientAsync();
            await CreateIntegrationAsync(client, IntegrationPayload(name: "Payments One", category: "payments"));
            await CreateIntegrationAsync(client, IntegrationPayload(name: "Channel Two", category: "channel"));

            var response = await client.GetAsync("/api/v1/integrations?category=payments");
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data").EnumerateArray().ToList();

            data.Should().NotBeEmpty();
            data.Should().OnlyContain(i => i.GetProperty("category").GetString() == "payments");
        }

        [Fact]
        public async Task Update_Then_Get_Shows_Changes()
        {
            var client = await AdminClientAsync();
            var id = await CreateIntegrationAsync(client);

            var update = await client.PutAsync($"/api/v1/integrations/{id}",
                JsonBody(new { description = "Updated description" }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/integrations/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("description").GetString().Should().Be("Updated description");
            envelope.GetProperty("data").GetProperty("name").GetString().Should().Be("Stripe Connect");
        }

        [Fact]
        public async Task Delete_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();
            var id = await CreateIntegrationAsync(client);

            var delete = await client.DeleteAsync($"/api/v1/integrations/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            var get = await client.GetAsync($"/api/v1/integrations/{id}");
            get.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Manager_Cannot_Delete_Integration()
        {
            var admin = await AdminClientAsync();
            var id = await CreateIntegrationAsync(admin);
            var manager = await ManagerClientAsync();

            var response = await manager.DeleteAsync($"/api/v1/integrations/{id}");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
