using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class RatePlansApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public RatePlansApiTests(AquriApiFactory factory) : base(factory) { }

        [Fact]
        public async Task Create_Returns_201_With_Plan()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/rateplans",
                JsonBody(new { propertyId = 1, name = "Summer Peak", baseRate = 1500m, season = "high", minStay = 2, roomTypes = new[] { "suite" }, restrictions = new[] { "no_same_day" } }));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            envelope.GetProperty("data").GetProperty("name").GetString().Should().Be("Summer Peak");
            envelope.GetProperty("data").GetProperty("season").GetString().Should().Be("high");
        }

        [Fact]
        public async Task Create_Invalid_Season_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/rateplans",
                JsonBody(new { propertyId = 1, name = "Bad", baseRate = 100m, season = "monsoon", minStay = 1 }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Get_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/rateplans/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task List_Filters_By_Property()
        {
            var client = await AdminClientAsync();
            await client.PostAsync("/api/v1/rateplans",
                JsonBody(new { propertyId = 1, name = "List Filter Plan", baseRate = 900m, season = "low", minStay = 1 }));
            await client.PostAsync("/api/v1/rateplans",
                JsonBody(new { propertyId = 2, name = "Other Property Plan", baseRate = 1100m, season = "low", minStay = 1 }));

            var response = await client.GetAsync("/api/v1/rateplans?propertyId=2");
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data").EnumerateArray().ToList();

            data.Should().Contain(p => p.GetProperty("name").GetString() == "Other Property Plan");
            data.Should().NotContain(p => p.GetProperty("name").GetString() == "List Filter Plan");
        }

        [Fact]
        public async Task Update_Then_Get_Shows_Changes()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/rateplans",
                JsonBody(new { propertyId = 1, name = "Updatable", baseRate = 800m, season = "shoulder", minStay = 1 }));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/rateplans/{id}",
                JsonBody(new { baseRate = 950m, active = false }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/rateplans/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("baseRate").GetDecimal().Should().Be(950m);
            envelope.GetProperty("data").GetProperty("active").GetBoolean().Should().BeFalse();
        }

        [Fact]
        public async Task Update_Without_BaseRate_Preserves_It()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/rateplans",
                JsonBody(new { propertyId = 1, name = "Toggle Only", baseRate = 800m, season = "shoulder", minStay = 1 }));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/rateplans/{id}",
                JsonBody(new { active = false }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/rateplans/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("baseRate").GetDecimal().Should().Be(800m);
            envelope.GetProperty("data").GetProperty("active").GetBoolean().Should().BeFalse();
        }

        [Fact]
        public async Task Delete_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/rateplans",
                JsonBody(new { propertyId = 1, name = "Temporary Plan", baseRate = 100m, season = "low", minStay = 1 }));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var delete = await client.DeleteAsync($"/api/v1/rateplans/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            var get = await client.GetAsync($"/api/v1/rateplans/{id}");
            get.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task FrontDesk_Cannot_Create_Plan()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.PostAsync("/api/v1/rateplans",
                JsonBody(new { propertyId = 1, name = "Nope", baseRate = 100m, season = "low", minStay = 1 }));

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
