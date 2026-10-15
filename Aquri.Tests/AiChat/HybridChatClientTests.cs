using System.Net;
using System.Text;
using Aquri.Application.AiChat;
using Aquri.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Aquri.Tests.AiChat
{
    public class HybridChatClientTests
    {
        private const string FakeKey = "sk-test-key-never-in-payload";

        [Fact]
        public async Task Empty_key_answers_deterministically_without_any_http_call()
        {
            var handler = new FakeHandler();
            var client = BuildClient(handler, apiKey: string.Empty);

            var response = await client.RespondAsync("What is the occupancy?");

            response.Source.Should().Be("deterministic");
            response.Intent.Should().Be("occupancy");
            response.Reply.Should().Contain("Current Occupancy:");
            handler.SendCount.Should().Be(0);
        }

        [Fact]
        public async Task Llm_success_returns_llm_source_and_content()
        {
            var handler = new FakeHandler
            {
                ResponseJson = """{"choices":[{"message":{"content":"LLM answer here"}}]}"""
            };
            var client = BuildClient(handler, apiKey: FakeKey);

            var response = await client.RespondAsync("Tell me about revenue");

            response.Source.Should().Be("llm");
            response.Reply.Should().Be("LLM answer here");
            handler.SendCount.Should().Be(1);
            handler.LastAuthorization.Should().Be($"Bearer {FakeKey}");
        }

        [Fact]
        public async Task Llm_timeout_falls_back_to_deterministic()
        {
            var handler = new FakeHandler { ThrowOnSend = new TaskCanceledException("simulated timeout") };
            var client = BuildClient(handler, apiKey: FakeKey);

            var response = await client.RespondAsync("What is the occupancy?");

            response.Source.Should().Be("deterministic");
            response.Reply.Should().Contain("Current Occupancy:");
        }

        [Fact]
        public async Task Server_error_falls_back_to_deterministic()
        {
            var handler = new FakeHandler { StatusCode = HttpStatusCode.InternalServerError, ResponseJson = "oops" };
            var client = BuildClient(handler, apiKey: FakeKey);

            var response = await client.RespondAsync("How many rooms are available?");

            response.Source.Should().Be("deterministic");
            response.Intent.Should().Be("room");
        }

        [Fact]
        public async Task Malformed_json_falls_back_to_deterministic()
        {
            var handler = new FakeHandler { ResponseJson = "<html>not json</html>" };
            var client = BuildClient(handler, apiKey: FakeKey);

            var response = await client.RespondAsync("What is the occupancy?");

            response.Source.Should().Be("deterministic");
            response.Reply.Should().Contain("Current Occupancy:");
        }

        [Fact]
        public async Task Key_never_appears_in_the_reply_payload()
        {
            var handler = new FakeHandler
            {
                ResponseJson = """{"choices":[{"message":{"content":"clean answer"}}]}"""
            };
            var client = BuildClient(handler, apiKey: FakeKey);

            var response = await client.RespondAsync("hello");
            var serialized = System.Text.Json.JsonSerializer.Serialize(response);

            serialized.Should().NotContain(FakeKey);
        }

        private static HybridChatClient BuildClient(FakeHandler handler, string apiKey)
        {
            var options = Options.Create(new AiChatOptions
            {
                BaseUrl = "https://unit.test",
                Model = "test-model",
                ApiKey = apiKey,
                TimeoutSeconds = 5
            });

            var context = new AquriDbContext(
                new DbContextOptionsBuilder<AquriDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options);

            var stats = new ChatStatsProvider(context);
            var deterministic = new DeterministicChatClient(stats);
            var llm = new OpenAiCompatibleClient(new FakeHttpClientFactory(handler), options);

            return new HybridChatClient(deterministic, stats, llm, options, NullLogger<HybridChatClient>.Instance);
        }

        private sealed class FakeHttpClientFactory : IHttpClientFactory
        {
            private readonly HttpMessageHandler _handler;

            public FakeHttpClientFactory(HttpMessageHandler handler) => _handler = handler;

            public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false);
        }

        private sealed class FakeHandler : HttpMessageHandler
        {
            public string ResponseJson { get; set; } = "{}";
            public HttpStatusCode StatusCode { get; set; } = HttpStatusCode.OK;
            public Exception? ThrowOnSend { get; set; }
            public int SendCount { get; private set; }
            public string? LastAuthorization { get; private set; }

            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                SendCount++;
                LastAuthorization = request.Headers.Authorization?.ToString();

                if (ThrowOnSend is not null)
                    throw ThrowOnSend;

                return Task.FromResult(new HttpResponseMessage(StatusCode)
                {
                    Content = new StringContent(ResponseJson, Encoding.UTF8, "application/json")
                });
            }
        }
    }
}
