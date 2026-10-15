using System.Net;
using System.Text.Json;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace Aquri.Tests.Api
{
    public class AiInsightsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public AiInsightsApiTests(AquriApiFactory factory) : base(factory) { }

        private int SeedInsight(int? propertyId, string title, string type = "revenue", string impact = "high")
        {
            using var scope = Factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AquriDbContext>();
            var insight = new AiInsight(propertyId, type, title, "Seeded for tests.", "Act on it.", impact);
            db.AiInsights.Add(insight);
            db.SaveChanges();
            return insight.Id;
        }

        [Fact]
        public async Task Get_Without_Token_Returns_401()
        {
            var client = Factory.CreateClient();

            var response = await client.GetAsync("/api/v1/aiInsights");

            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }

        [Fact]
        public async Task Get_FrontDesk_Returns_403()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.GetAsync("/api/v1/aiInsights");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Delete_FrontDesk_Returns_403()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.DeleteAsync("/api/v1/aiInsights/1");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Get_Returns_Success_Envelope()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/aiInsights");

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            envelope.GetProperty("data").ValueKind.Should().Be(JsonValueKind.Array);
            envelope.TryGetProperty("requestId", out _).Should().BeTrue();
            envelope.TryGetProperty("timestamp", out _).Should().BeTrue();
        }

        [Fact]
        public async Task Get_Filters_By_PropertyId()
        {
            SeedInsight(777, "Seeded insight for property 777");
            SeedInsight(null, "Seeded global insight");
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/aiInsights?propertyId=777");

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            var items = envelope.GetProperty("data").EnumerateArray().ToList();
            items.Should().NotBeEmpty();
            items.Should().OnlyContain(i => i.GetProperty("propertyId").GetInt32() == 777);
        }

        [Fact]
        public async Task Get_Without_Filter_Includes_Global_Insights()
        {
            SeedInsight(null, "Seeded global-only insight");
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/aiInsights");

            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").EnumerateArray().Should().Contain(i =>
                i.GetProperty("title").GetString() == "Seeded global-only insight");
        }

        [Fact]
        public async Task Delete_Existing_Returns_204_Then_404()
        {
            var id = SeedInsight(null, "Insight to delete");
            var client = await AdminClientAsync();

            var first = await client.DeleteAsync($"/api/v1/aiInsights/{id}");
            first.StatusCode.Should().Be(HttpStatusCode.NoContent);

            var second = await client.DeleteAsync($"/api/v1/aiInsights/{id}");
            second.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Delete_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.DeleteAsync("/api/v1/aiInsights/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        private static object NewInsight(
            int? propertyId = 1,
            string type = "revenue",
            string title = "Weekend pricing is under market",
            string impact = "high") =>
            new { propertyId, type, title, description = "Saturday ADR trails comp set by 8%.", recommendation = "Raise weekend rate 6%.", impact };

        [Fact]
        public async Task Create_Returns_201_With_Defaults()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/aiInsights", JsonBody(NewInsight()));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data");
            data.GetProperty("id").GetInt32().Should().BeGreaterThan(0);
            data.GetProperty("type").GetString().Should().Be("revenue");
            data.GetProperty("impact").GetString().Should().Be("high");
            data.GetProperty("dismissed").ValueKind.Should().Be(JsonValueKind.Null);
        }

        [Fact]
        public async Task Create_Invalid_Type_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/aiInsights",
                JsonBody(NewInsight(type: "astrology")));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Create_Invalid_Impact_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/aiInsights",
                JsonBody(NewInsight(impact: "catastrophic")));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Create_Empty_Title_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/aiInsights",
                JsonBody(NewInsight(title: "")));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Create_Without_Token_Returns_401()
        {
            var client = Factory.CreateClient();

            var response = await client.PostAsync("/api/v1/aiInsights", JsonBody(NewInsight()));

            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }

        private async Task<int> CreateInsight(HttpClient client, object? payload = null)
        {
            var response = await client.PostAsync("/api/v1/aiInsights", JsonBody(payload ?? NewInsight()));
            response.StatusCode.Should().Be(HttpStatusCode.Created);
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        [Fact]
        public async Task Update_Sparse_Changes_Title_Only()
        {
            var client = await AdminClientAsync();
            var id = await CreateInsight(client);

            var response = await client.PutAsync($"/api/v1/aiInsights/{id}",
                JsonBody(new { title = "Weekend pricing corrected" }));

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data");
            data.GetProperty("title").GetString().Should().Be("Weekend pricing corrected");
            data.GetProperty("type").GetString().Should().Be("revenue");
            data.GetProperty("impact").GetString().Should().Be("high");
            data.GetProperty("dismissed").ValueKind.Should().Be(JsonValueKind.Null);
        }

        [Fact]
        public async Task Update_Dismissed_Round_Trips_Through_Tri_State()
        {
            var client = await AdminClientAsync();
            var id = await CreateInsight(client);

            var dismiss = await client.PutAsync($"/api/v1/aiInsights/{id}",
                JsonBody(new { dismissed = true }));
            dismiss.StatusCode.Should().Be(HttpStatusCode.OK);
            (await ParseAsync(dismiss)).GetProperty("data").GetProperty("dismissed").GetBoolean().Should().BeTrue();

            var acknowledge = await client.PutAsync($"/api/v1/aiInsights/{id}",
                JsonBody(new { dismissed = false }));
            acknowledge.StatusCode.Should().Be(HttpStatusCode.OK);
            (await ParseAsync(acknowledge)).GetProperty("data").GetProperty("dismissed").GetBoolean().Should().BeFalse();

            var untouched = await client.PutAsync($"/api/v1/aiInsights/{id}",
                JsonBody(new { title = "Renamed after acknowledge" }));
            (await ParseAsync(untouched)).GetProperty("data").GetProperty("dismissed").GetBoolean().Should().BeFalse();
        }

        [Fact]
        public async Task Update_Invalid_Impact_Returns_400_And_Changes_Nothing()
        {
            var client = await AdminClientAsync();
            var id = await CreateInsight(client);

            var update = await client.PutAsync($"/api/v1/aiInsights/{id}",
                JsonBody(new { impact = "catastrophic" }));

            update.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var get = await client.GetAsync($"/api/v1/aiInsights?propertyId=1");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").EnumerateArray().Should().Contain(i =>
                i.GetProperty("id").GetInt32() == id &&
                i.GetProperty("impact").GetString() == "high");
        }

        [Fact]
        public async Task Update_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.PutAsync("/api/v1/aiInsights/999999",
                JsonBody(new { title = "Ghost edit" }));

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
    }
}
