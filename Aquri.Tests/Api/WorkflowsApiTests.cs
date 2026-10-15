using System.Net;
using System.Text.Json;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace Aquri.Tests.Api
{
    public class WorkflowsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public WorkflowsApiTests(AquriApiFactory factory) : base(factory) { }

        private int SeedWorkflow(string name, string status = "active", int? propertyId = null)
        {
            using var scope = Factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AquriDbContext>();
            var workflow = new Workflow(
                propertyId, name, "Seeded for tests.",
                "Occupancy drops below 60%",
                JsonSerializer.Serialize(new[] { "Send alert email", "Open staff ticket" }),
                status, "admin@nexus.com");
            db.Workflows.Add(workflow);
            db.SaveChanges();
            return workflow.Id;
        }

        [Fact]
        public async Task Get_Without_Token_Returns_401()
        {
            var client = Factory.CreateClient();

            var response = await client.GetAsync("/api/v1/workflows");

            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }

        [Fact]
        public async Task Get_FrontDesk_Returns_403()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.GetAsync("/api/v1/workflows");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Get_Returns_Success_Envelope()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/workflows");

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            envelope.GetProperty("data").ValueKind.Should().Be(JsonValueKind.Array);
            envelope.TryGetProperty("requestId", out _).Should().BeTrue();
            envelope.TryGetProperty("timestamp", out _).Should().BeTrue();
        }

        [Fact]
        public async Task Get_Returns_Actions_As_String_Array()
        {
            SeedWorkflow("Seeded actions workflow");
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/workflows");

            var envelope = await ParseAsync(response);
            var workflow = envelope.GetProperty("data").EnumerateArray().Single(w =>
                w.GetProperty("name").GetString() == "Seeded actions workflow");
            var actions = workflow.GetProperty("actions").EnumerateArray()
                .Select(a => a.GetString()).ToList();
            actions.Should().Equal("Send alert email", "Open staff ticket");
        }

        [Fact]
        public async Task Delete_Existing_Returns_204_Then_404()
        {
            var id = SeedWorkflow("Workflow to delete");
            var client = await AdminClientAsync();

            var first = await client.DeleteAsync($"/api/v1/workflows/{id}");
            first.StatusCode.Should().Be(HttpStatusCode.NoContent);

            var second = await client.DeleteAsync($"/api/v1/workflows/{id}");
            second.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Delete_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.DeleteAsync("/api/v1/workflows/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Delete_FrontDesk_Returns_403()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.DeleteAsync("/api/v1/workflows/1");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        private static object NewWorkflow(
            string name = "Guest feedback follow-up",
            object? actions = null,
            string status = "active") =>
            new
            {
                name,
                description = "Route 1-star reviews to the duty manager.",
                trigger = "Review score below 3",
                actions = actions ?? new[] { "Notify manager", "Open ticket" },
                status,
                createdBy = "system"
            };

        [Fact]
        public async Task Create_Returns_201_With_Defaults()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/workflows", JsonBody(NewWorkflow()));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data");
            data.GetProperty("id").GetInt32().Should().BeGreaterThan(0);
            data.GetProperty("name").GetString().Should().Be("Guest feedback follow-up");
            data.GetProperty("status").GetString().Should().Be("active");
            data.GetProperty("createdBy").GetString().Should().Be("system");
            data.GetProperty("lastRun").ValueKind.Should().Be(JsonValueKind.Null);
            data.GetProperty("actions").EnumerateArray().Should().HaveCount(2);
        }

        [Fact]
        public async Task Create_Empty_Name_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/workflows", JsonBody(NewWorkflow(name: "")));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Create_Empty_Actions_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/workflows",
                JsonBody(NewWorkflow(actions: Array.Empty<string>())));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Create_Invalid_Status_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/workflows", JsonBody(NewWorkflow(status: "paused")));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Create_Without_Token_Returns_401()
        {
            var client = Factory.CreateClient();

            var response = await client.PostAsync("/api/v1/workflows", JsonBody(NewWorkflow()));

            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }

        private async Task<int> CreateWorkflow(HttpClient client)
        {
            var response = await client.PostAsync("/api/v1/workflows", JsonBody(NewWorkflow()));
            response.StatusCode.Should().Be(HttpStatusCode.Created);
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        [Fact]
        public async Task Update_Sparse_Changes_Status_Only()
        {
            var client = await AdminClientAsync();
            var id = await CreateWorkflow(client);

            var response = await client.PutAsync($"/api/v1/workflows/{id}",
                JsonBody(new { status = "inactive" }));

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data");
            data.GetProperty("status").GetString().Should().Be("inactive");
            data.GetProperty("name").GetString().Should().Be("Guest feedback follow-up");
            data.GetProperty("trigger").GetString().Should().Be("Review score below 3");
            data.GetProperty("actions").EnumerateArray().Should().HaveCount(2);
        }

        [Fact]
        public async Task Update_Actions_Replaces_Array()
        {
            var client = await AdminClientAsync();
            var id = await CreateWorkflow(client);

            var response = await client.PutAsync($"/api/v1/workflows/{id}",
                JsonBody(new { actions = new[] { "Only remaining step" } }));

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("actions").EnumerateArray()
                .Select(a => a.GetString()).Should().Equal("Only remaining step");
        }

        [Fact]
        public async Task Update_Invalid_Status_Returns_400_And_Changes_Nothing()
        {
            var client = await AdminClientAsync();
            var id = await CreateWorkflow(client);

            var update = await client.PutAsync($"/api/v1/workflows/{id}",
                JsonBody(new { status = "paused" }));

            update.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var get = await client.GetAsync("/api/v1/workflows");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").EnumerateArray().Should().Contain(w =>
                w.GetProperty("id").GetInt32() == id &&
                w.GetProperty("status").GetString() == "active");
        }

        [Fact]
        public async Task Update_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.PutAsync("/api/v1/workflows/999999",
                JsonBody(new { name = "Ghost workflow" }));

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
    }
}
