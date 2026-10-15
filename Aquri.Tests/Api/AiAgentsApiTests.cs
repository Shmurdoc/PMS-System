using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace Aquri.Tests.Api
{
    public class AiAgentsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public AiAgentsApiTests(AquriApiFactory factory) : base(factory) { }

        private int SeedAgent(string key, string status = "running", int logCount = 0)
        {
            using var scope = Factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AquriDbContext>();
            var agent = new Agent(key, $"Agent {key}", $"Test agent {key}.", status);
            db.Agents.Add(agent);
            db.SaveChanges();

            for (var i = 0; i < logCount; i++)
                db.AgentLogs.Add(new AgentLog(agent.Id, $"Log entry {i}"));
            if (logCount > 0)
                db.SaveChanges();

            return agent.Id;
        }

        [Fact]
        public async Task Get_Without_Token_Returns_401()
        {
            var client = Factory.CreateClient();

            var response = await client.GetAsync("/api/v1/agents");

            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }

        [Fact]
        public async Task Get_FrontDesk_Returns_403()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.GetAsync("/api/v1/agents");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Patch_FrontDesk_Returns_403()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.PatchAsJsonAsync("/api/v1/agents/1/status", new { status = "paused" });

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Get_Returns_Success_Envelope_With_Agent_Array()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/agents");

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            envelope.GetProperty("data").ValueKind.Should().Be(JsonValueKind.Array);
            envelope.TryGetProperty("requestId", out _).Should().BeTrue();
            envelope.TryGetProperty("timestamp", out _).Should().BeTrue();
        }

        [Fact]
        public async Task Get_Includes_Key_Status_And_Logs()
        {
            SeedAgent("test-agent-shape", logCount: 3);
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/agents");

            var envelope = await ParseAsync(response);
            var agent = envelope.GetProperty("data").EnumerateArray()
                .Single(a => a.GetProperty("key").GetString() == "test-agent-shape");

            agent.GetProperty("id").GetInt32().Should().BeGreaterThan(0);
            agent.GetProperty("status").GetString().Should().Be("running");
            agent.GetProperty("totalRuns").GetInt32().Should().Be(0);
            agent.GetProperty("logs").ValueKind.Should().Be(JsonValueKind.Array);
            agent.GetProperty("logs").GetArrayLength().Should().Be(3);
            var firstLog = agent.GetProperty("logs").EnumerateArray().First();
            firstLog.TryGetProperty("time", out _).Should().BeTrue();
            firstLog.GetProperty("message").GetString().Should().StartWith("Log entry");
        }

        [Fact]
        public async Task Get_Logs_Capped_At_20_Newest_First()
        {
            SeedAgent("test-agent-cap", logCount: 25);
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/agents");

            var envelope = await ParseAsync(response);
            var agent = envelope.GetProperty("data").EnumerateArray()
                .Single(a => a.GetProperty("key").GetString() == "test-agent-cap");

            var logs = agent.GetProperty("logs").EnumerateArray().ToList();
            logs.Should().HaveCount(20);
            logs.First().GetProperty("message").GetString().Should().Be("Log entry 24");
            logs.Last().GetProperty("message").GetString().Should().Be("Log entry 5");
        }

        [Fact]
        public async Task Patch_Valid_Status_Updates_Agent()
        {
            var id = SeedAgent("test-agent-status", status: "running");
            var client = await AdminClientAsync();

            var response = await client.PatchAsJsonAsync($"/api/v1/agents/{id}/status", new { status = "paused" });

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            envelope.GetProperty("data").GetProperty("status").GetString().Should().Be("paused");
        }

        [Fact]
        public async Task Patch_Invalid_Status_Returns_400_Validation()
        {
            var id = SeedAgent("test-agent-badstatus");
            var client = await AdminClientAsync();

            var response = await client.PatchAsJsonAsync($"/api/v1/agents/{id}/status", new { status = "sleeping" });

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeFalse();
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Patch_Missing_Agent_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.PatchAsJsonAsync("/api/v1/agents/999999/status", new { status = "paused" });

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Run_FrontDesk_Returns_403()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.PostAsJsonAsync("/api/v1/agents/1/run", new { });

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Run_Returns_Insight_And_Bumps_Counters()
        {
            var id = SeedAgent("revenue-optimizer", status: "running");
            var client = await AdminClientAsync();

            var response = await client.PostAsJsonAsync($"/api/v1/agents/{id}/run", new { });

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeTrue();

            var data = envelope.GetProperty("data");
            var agent = data.GetProperty("agent");
            agent.GetProperty("id").GetInt32().Should().Be(id);
            agent.GetProperty("totalRuns").GetInt32().Should().Be(1);
            agent.GetProperty("logs").GetArrayLength().Should().Be(1);
            agent.GetProperty("logs").EnumerateArray().First().GetProperty("message").GetString()
                .Should().Contain("bookings");

            var insight = data.GetProperty("insight");
            insight.GetProperty("id").GetInt32().Should().BeGreaterThan(0);
            insight.GetProperty("type").GetString().Should().Be("revenue");
            insight.GetProperty("title").GetString().Should().NotBeNullOrWhiteSpace();
            insight.GetProperty("recommendation").GetString().Should().NotBeNullOrWhiteSpace();
        }

        [Theory]
        [InlineData("revenue-optimizer", "revenue")]
        [InlineData("guest-predictor", "guest")]
        [InlineData("maintenance-scheduler", "maintenance")]
        [InlineData("rate-analyzer", "revenue")]
        [InlineData("staffing-optimizer", "staffing")]
        [InlineData("inventory-monitor", "operational")]
        public async Task Run_Each_Key_Maps_To_Expected_Insight_Type(string key, string expectedType)
        {
            var id = SeedAgent(key, status: "running");
            var client = await AdminClientAsync();

            var response = await client.PostAsJsonAsync($"/api/v1/agents/{id}/run", new { });

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("insight").GetProperty("type").GetString()
                .Should().Be(expectedType);
        }

        [Fact]
        public async Task Run_Twice_Increments_TotalRuns_And_Appends_Log()
        {
            var id = SeedAgent("rate-analyzer", status: "running");
            var client = await AdminClientAsync();

            var first = await client.PostAsJsonAsync($"/api/v1/agents/{id}/run", new { });
            var second = await client.PostAsJsonAsync($"/api/v1/agents/{id}/run", new { });

            first.StatusCode.Should().Be(HttpStatusCode.OK);
            second.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(second);
            var agent = envelope.GetProperty("data").GetProperty("agent");
            agent.GetProperty("totalRuns").GetInt32().Should().Be(2);
            agent.GetProperty("logs").GetArrayLength().Should().Be(2);
        }

        [Fact]
        public async Task Run_Stopped_Agent_Returns_400_Validation()
        {
            var id = SeedAgent("staffing-optimizer", status: "stopped");
            var client = await AdminClientAsync();

            var response = await client.PostAsJsonAsync($"/api/v1/agents/{id}/run", new { });

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeFalse();
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Run_Missing_Agent_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsJsonAsync("/api/v1/agents/999999/run", new { });

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
    }
}
