using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class TaxConfigsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public TaxConfigsApiTests(AquriApiFactory factory) : base(factory) { }

        private static object NewVat(decimal rate = 0.15m, string name = "VAT 15%") =>
            new { propertyId = 1, name, rate, type = "vat" };

        [Fact]
        public async Task Create_Returns_201_With_Defaults()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/taxconfigs", JsonBody(NewVat()));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data");
            data.GetProperty("rate").GetDecimal().Should().Be(0.15m);
            data.GetProperty("active").GetBoolean().Should().BeTrue();
            data.GetProperty("type").GetString().Should().Be("vat");
        }

        [Fact]
        public async Task Create_Invalid_Type_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/taxconfigs",
                JsonBody(new { propertyId = 1, name = "Bad", rate = 0.1m, type = "nonsense" }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Create_RateAboveOne_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/taxconfigs",
                JsonBody(new { propertyId = 1, name = "VAT", rate = 15, type = "vat" }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Get_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/taxconfigs/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task List_Filters_By_Type_And_Active()
        {
            var client = await AdminClientAsync();
            await client.PostAsync("/api/v1/taxconfigs", JsonBody(NewVat()));
            await client.PostAsync("/api/v1/taxconfigs",
                JsonBody(new { propertyId = 1, name = "Tourism levy", rate = 0.01m, type = "tourism_levy" }));

            var byType = await client.GetAsync("/api/v1/taxconfigs?type=tourism_levy");
            var envelope = await ParseAsync(byType);
            var data = envelope.GetProperty("data").EnumerateArray().ToList();
            data.Should().OnlyContain(t => t.GetProperty("type").GetString() == "tourism_levy");

            var active = await client.GetAsync("/api/v1/taxconfigs?active=true");
            var activeEnvelope = await ParseAsync(active);
            activeEnvelope.GetProperty("data").EnumerateArray().Should().OnlyContain(t =>
                t.GetProperty("active").GetBoolean());
        }

        [Fact]
        public async Task Sparse_Update_Changes_Rate_Only()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/taxconfigs", JsonBody(NewVat(name: "VAT old name")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/taxconfigs/{id}",
                JsonBody(new { rate = 0.16m }));

            update.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(update);
            var data = envelope.GetProperty("data");
            data.GetProperty("rate").GetDecimal().Should().Be(0.16m);
            data.GetProperty("name").GetString().Should().Be("VAT old name");
        }

        [Fact]
        public async Task Update_Cannot_End_Window_Before_ValidFrom()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/taxconfigs",
                JsonBody(new { propertyId = 1, name = "VAT", rate = 0.15m, type = "vat",
                    validFrom = new DateTime(2026, 1, 1) }));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/taxconfigs/{id}",
                JsonBody(new { validTo = new DateTime(2025, 6, 1) }));

            update.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Deactivate_Then_Reactivate_Attempt_Is_Ignored()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/taxconfigs", JsonBody(NewVat()));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var deactivate = await client.PutAsync($"/api/v1/taxconfigs/{id}",
                JsonBody(new { active = false }));
            deactivate.StatusCode.Should().Be(HttpStatusCode.OK);

            var reactivate = await client.PutAsync($"/api/v1/taxconfigs/{id}",
                JsonBody(new { active = true }));
            reactivate.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(reactivate);
            envelope.GetProperty("data").GetProperty("active").GetBoolean().Should().BeFalse();
        }

        [Fact]
        public async Task Delete_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/taxconfigs", JsonBody(NewVat(name: "Temp tax")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var delete = await client.DeleteAsync($"/api/v1/taxconfigs/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            var get = await client.GetAsync($"/api/v1/taxconfigs/{id}");
            get.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task FrontDesk_Can_Read_But_Cannot_Write()
        {
            var client = await FrontDeskClientAsync();

            var list = await client.GetAsync("/api/v1/taxconfigs");
            list.StatusCode.Should().Be(HttpStatusCode.OK);

            var create = await client.PostAsync("/api/v1/taxconfigs", JsonBody(NewVat()));
            create.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
