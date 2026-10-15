using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class MaintenanceRequestsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public MaintenanceRequestsApiTests(AquriApiFactory factory) : base(factory) { }

        private static object NewRequest(
            int propertyId = 1,
            string description = "Leaking tap in room 101",
            string priority = "high") =>
            new { propertyId, description, priority };

        [Fact]
        public async Task Create_Returns_201_With_Defaults()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/maintenancerequests", JsonBody(NewRequest()));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data");
            data.GetProperty("status").GetString().Should().Be("pending");
            data.GetProperty("priority").GetString().Should().Be("high");
            data.GetProperty("description").GetString().Should().Be("Leaking tap in room 101");
        }

        [Fact]
        public async Task Create_Empty_Description_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/maintenancerequests",
                JsonBody(new { propertyId = 1, description = "" }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Create_Invalid_Priority_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/maintenancerequests",
                JsonBody(new { propertyId = 1, description = "Fix", priority = "catastrophic" }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Create_Invalid_Status_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/maintenancerequests",
                JsonBody(new { propertyId = 1, description = "Fix", status = "wontfix" }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Get_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/maintenancerequests/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task List_Filters_By_Status_And_Priority()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/maintenancerequests",
                JsonBody(NewRequest(description: "Urgent boiler fix", priority: "urgent")));
            create.StatusCode.Should().Be(HttpStatusCode.Created);
            await client.PostAsync("/api/v1/maintenancerequests",
                JsonBody(NewRequest(description: "Paint scuff", priority: "low")));

            var byPriority = await client.GetAsync("/api/v1/maintenancerequests?priority=urgent");
            var envelope = await ParseAsync(byPriority);
            envelope.GetProperty("data").EnumerateArray().Should().OnlyContain(m =>
                m.GetProperty("priority").GetString() == "urgent");

            var byStatus = await client.GetAsync("/api/v1/maintenancerequests?status=pending");
            var statusEnvelope = await ParseAsync(byStatus);
            statusEnvelope.GetProperty("data").EnumerateArray().Should().OnlyContain(m =>
                m.GetProperty("status").GetString() == "pending");
        }

        [Fact]
        public async Task Sparse_Update_Changes_Status_And_Priority()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/maintenancerequests", JsonBody(NewRequest()));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/maintenancerequests/{id}",
                JsonBody(new { status = "in_progress", priority = "urgent" }));

            update.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(update);
            var data = envelope.GetProperty("data");
            data.GetProperty("status").GetString().Should().Be("in_progress");
            data.GetProperty("priority").GetString().Should().Be("urgent");
            data.GetProperty("description").GetString().Should().Be("Leaking tap in room 101");
        }

        [Fact]
        public async Task Update_Invalid_Status_Returns_400_And_Changes_Nothing()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/maintenancerequests", JsonBody(NewRequest()));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/maintenancerequests/{id}",
                JsonBody(new { status = "wontfix" }));
            update.StatusCode.Should().Be(HttpStatusCode.BadRequest);

            var get = await client.GetAsync($"/api/v1/maintenancerequests/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("status").GetString().Should().Be("pending");
        }

        [Fact]
        public async Task Delete_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/maintenancerequests", JsonBody(NewRequest(description: "Temp")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var delete = await client.DeleteAsync($"/api/v1/maintenancerequests/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            var get = await client.GetAsync($"/api/v1/maintenancerequests/{id}");
            get.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task FrontDesk_Can_Create_And_Update_But_Needs_Auth()
        {
            var client = await FrontDeskClientAsync();

            var create = await client.PostAsync("/api/v1/maintenancerequests",
                JsonBody(NewRequest(description: "From front desk")));
            create.StatusCode.Should().Be(HttpStatusCode.Created);
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/maintenancerequests/{id}",
                JsonBody(new { status = "scheduled" }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var anon = Factory.CreateClient();
            var unauthorized = await anon.GetAsync($"/api/v1/maintenancerequests/{id}");
            unauthorized.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }
    }
}
