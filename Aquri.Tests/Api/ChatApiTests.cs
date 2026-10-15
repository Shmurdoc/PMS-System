using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class ChatApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public ChatApiTests(AquriApiFactory factory) : base(factory) { }

        private static object Chat(string message) => new { message };

        [Fact]
        public async Task Send_Without_Token_Returns_401()
        {
            var client = Factory.CreateClient();

            var response = await client.PostAsync("/api/v1/chat", JsonBody(Chat("occupancy please")));

            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }

        [Fact]
        public async Task Send_FrontDesk_Returns_403()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.PostAsync("/api/v1/chat", JsonBody(Chat("occupancy please")));

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Empty_Message_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/chat", JsonBody(Chat("")));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Occupancy_Intent_Answers_From_Live_Data()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/chat",
                JsonBody(Chat("What's the current occupancy?")));

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            envelope.TryGetProperty("requestId", out _).Should().BeTrue();
            envelope.TryGetProperty("timestamp", out _).Should().BeTrue();
            var data = envelope.GetProperty("data");
            data.GetProperty("source").GetString().Should().Be("deterministic");
            data.GetProperty("intent").GetString().Should().Be("occupancy");
            data.GetProperty("reply").GetString().Should().Contain("Current Occupancy:");
        }

        [Theory]
        [InlineData("How much money did we make?", "revenue", "Total booking revenue:")]
        [InlineData("How are our customers doing?", "guest", "Total guests in system:")]
        [InlineData("Any reservations coming up?", "booking", "Total bookings:")]
        [InlineData("Do you have any vacancy?", "room", "Total rooms:")]
        [InlineData("Any schedule tips?", "staff", "Based on current")]
        [InlineData("How about our rates?", "price", "Average nightly rate:")]
        [InlineData("Show me the trend", "forecast", "projected occupancy")]
        [InlineData("Any overdue payments?", "invoice", "Total invoices:")]
        [InlineData("What can you do?", "help", "I can help with:")]
        [InlineData("Hello there friend", "default", "Try asking")]
        public async Task Every_Intent_Returns_Expected_Reply(string message, string intent, string fragment)
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/chat", JsonBody(Chat(message)));

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var data = doc.RootElement.GetProperty("data");
            data.GetProperty("source").GetString().Should().Be("deterministic");
            data.GetProperty("intent").GetString().Should().Be(intent);
            data.GetProperty("reply").GetString().Should().Contain(fragment);
        }
    }
}
