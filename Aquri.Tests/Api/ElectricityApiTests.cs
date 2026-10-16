using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class ElectricityApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public ElectricityApiTests(AquriApiFactory factory) : base(factory) { }

        private static object ReadingPayload(
            int propertyId = 1,
            decimal consumption = 420.5m,
            decimal cost = 75.25m,
            decimal peakDemand = 12.4m,
            string zone = "Floor 3") =>
            new
            {
                propertyId,
                date = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                consumption,
                cost,
                peakDemand,
                zone
            };

        private async Task<int> CreateReadingAsync(HttpClient client, object? payload = null)
        {
            var response = await client.PostAsync("/api/v1/electricity", JsonBody(payload ?? ReadingPayload()));
            response.StatusCode.Should().Be(HttpStatusCode.Created);
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        [Fact]
        public async Task Create_Returns_201_With_Reading()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/electricity",
                JsonBody(ReadingPayload()));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            var data = envelope.GetProperty("data");
            data.GetProperty("zone").GetString().Should().Be("Floor 3");
            data.GetProperty("consumption").GetDecimal().Should().Be(420.5m);
            data.GetProperty("cost").GetDecimal().Should().Be(75.25m);
            data.GetProperty("peakDemand").GetDecimal().Should().Be(12.4m);
        }

        [Fact]
        public async Task Create_Negative_Consumption_Returns_400_VALIDATION()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/electricity",
                JsonBody(ReadingPayload(consumption: -1m)));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Get_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/electricity/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task List_Filters_By_Zone()
        {
            var client = await AdminClientAsync();
            await CreateReadingAsync(client, ReadingPayload(zone: "North Wing"));
            await CreateReadingAsync(client, ReadingPayload(zone: "South Wing"));

            var response = await client.GetAsync("/api/v1/electricity?zone=North%20Wing");
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data").EnumerateArray().ToList();

            data.Should().NotBeEmpty();
            data.Should().OnlyContain(r => r.GetProperty("zone").GetString() == "North Wing");
        }

        [Fact]
        public async Task Update_Then_Get_Shows_Changes()
        {
            var client = await AdminClientAsync();
            var id = await CreateReadingAsync(client);

            var update = await client.PutAsync($"/api/v1/electricity/{id}",
                JsonBody(new { consumption = 500m, cost = 88m }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/electricity/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("consumption").GetDecimal().Should().Be(500m);
            envelope.GetProperty("data").GetProperty("cost").GetDecimal().Should().Be(88m);
            envelope.GetProperty("data").GetProperty("zone").GetString().Should().Be("Floor 3");
        }

        [Fact]
        public async Task Update_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var update = await client.PutAsync("/api/v1/electricity/999999",
                JsonBody(new { consumption = 100m }));

            update.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Delete_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();
            var id = await CreateReadingAsync(client);

            var delete = await client.DeleteAsync($"/api/v1/electricity/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            var get = await client.GetAsync($"/api/v1/electricity/{id}");
            get.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task FrontDesk_Cannot_Delete_Reading()
        {
            var admin = await AdminClientAsync();
            var id = await CreateReadingAsync(admin);
            var frontDesk = await FrontDeskClientAsync();

            var response = await frontDesk.DeleteAsync($"/api/v1/electricity/{id}");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
