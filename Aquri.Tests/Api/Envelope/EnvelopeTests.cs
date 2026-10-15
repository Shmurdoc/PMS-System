using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Aquri.Tests.Api.Envelope
{
    /// <summary>
    /// Contract tests for the ApiResponse envelope produced by
    /// ApiResponseMiddleware: shape, error-code taxonomy, X-Request-ID echo,
    /// and the excluded paths (/health, /swagger). One case per outcome in the
    /// 200/201/400/401/403/404 matrix — the template for every future controller.
    /// </summary>
    public class EnvelopeTests : IClassFixture<AquriApiFactory>
    {
        private readonly AquriApiFactory _factory;

        public EnvelopeTests(AquriApiFactory factory) => _factory = factory;

        // ----- 200 success -----

        [Fact]
        public async Task Login_Returns_Enveloped_Success()
        {
            var client = _factory.CreateClient();

            var response = await client.PostAsync("/api/v1/auth/login",
                JsonBody(new { email = "admin@nexus.com", password = "admin123" }));

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);

            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            envelope.GetProperty("error").ValueKind.Should().Be(JsonValueKind.Null);
            envelope.GetProperty("data").GetProperty("token").GetString().Should().NotBeNullOrWhiteSpace();
            envelope.GetProperty("requestId").GetString().Should().NotBeNullOrWhiteSpace();
            envelope.GetProperty("timestamp").GetString().Should().NotBeNullOrWhiteSpace();
        }

        [Fact]
        public async Task Authenticated_Get_Returns_Enveloped_Data_Array()
        {
            var client = await AuthenticatedClientAsync("admin@nexus.com", "admin123");

            var response = await client.GetAsync("/api/v1/guests");

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);

            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            envelope.GetProperty("data").ValueKind.Should().Be(JsonValueKind.Array);
        }

        // ----- 400 validation -----

        [Fact]
        public async Task InvalidCommand_Returns_Enveloped_400_With_Validation_Code()
        {
            var client = await AuthenticatedClientAsync("admin@nexus.com", "admin123");

            var response = await client.PostAsync("/api/v1/guests",
                JsonBody(new { name = "", email = "x@y.com", phone = "1", idNumber = "1", nationality = "SA" }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);

            envelope.GetProperty("success").GetBoolean().Should().BeFalse();
            envelope.GetProperty("data").ValueKind.Should().Be(JsonValueKind.Null);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
            envelope.GetProperty("error").GetProperty("message").GetString().Should().NotBeNullOrWhiteSpace();
            envelope.GetProperty("requestId").GetString().Should().NotBeNullOrWhiteSpace();
        }

        // ----- 401 unauthenticated -----

        [Fact]
        public async Task MissingToken_Returns_Enveloped_401()
        {
            var client = _factory.CreateClient();

            var response = await client.GetAsync("/api/v1/guests");

            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
            var envelope = await ParseAsync(response);

            envelope.GetProperty("success").GetBoolean().Should().BeFalse();
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("UNAUTHORIZED");
            envelope.GetProperty("error").GetProperty("message").GetString().Should().NotBeNullOrWhiteSpace();
        }

        // ----- 403 wrong role -----

        [Fact]
        public async Task WrongRole_Returns_Enveloped_403()
        {
            // front_desk may not delete properties (admin-only endpoint)
            var client = await AuthenticatedClientAsync("front@nexus.com", "front123");

            var response = await client.DeleteAsync("/api/v1/properties/1");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
            var envelope = await ParseAsync(response);

            envelope.GetProperty("success").GetBoolean().Should().BeFalse();
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("FORBIDDEN");
            envelope.GetProperty("error").GetProperty("message").GetString().Should().NotBeNullOrWhiteSpace();
        }

        // ----- 404 missing resource -----

        [Fact]
        public async Task MissingResource_Returns_Enveloped_404()
        {
            var client = await AuthenticatedClientAsync("admin@nexus.com", "admin123");

            var response = await client.GetAsync("/api/v1/guests/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
            var envelope = await ParseAsync(response);

            envelope.GetProperty("success").GetBoolean().Should().BeFalse();
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("NOT_FOUND");
        }

        // ----- X-Request-ID correlation -----

        [Fact]
        public async Task Client_Supplied_RequestId_Is_Echoed()
        {
            var client = await AuthenticatedClientAsync("admin@nexus.com", "admin123");
            var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/guests");
            request.Headers.Add("X-Request-ID", "test-echo-123");

            var response = await client.SendAsync(request);

            response.Headers.GetValues("X-Request-ID").Single().Should().Be("test-echo-123");
            var envelope = await ParseAsync(response);
            envelope.GetProperty("requestId").GetString().Should().Be("test-echo-123");
        }

        [Fact]
        public async Task RequestId_Is_Generated_When_Client_Sends_None()
        {
            var client = await AuthenticatedClientAsync("admin@nexus.com", "admin123");

            var response = await client.GetAsync("/api/v1/guests");

            response.Headers.Contains("X-Request-ID").Should().BeTrue();
            var envelope = await ParseAsync(response);
            envelope.GetProperty("requestId").GetString().Should().NotBeNullOrWhiteSpace();
        }

        // ----- timestamp format -----

        [Fact]
        public async Task Timestamp_Is_Utc_Iso8601()
        {
            var client = _factory.CreateClient();

            var response = await client.PostAsync("/api/v1/auth/login",
                JsonBody(new { email = "admin@nexus.com", password = "admin123" }));

            var envelope = await ParseAsync(response);
            var timestampRaw = envelope.GetProperty("timestamp").GetString();

            timestampRaw.Should().NotBeNull();
            timestampRaw!.Should().EndWith("Z");
            var parsed = DateTime.Parse(timestampRaw!, null, System.Globalization.DateTimeStyles.RoundtripKind);
            parsed.Kind.Should().Be(DateTimeKind.Utc);
        }

        // ----- excluded paths -----

        [Fact]
        public async Task Health_Endpoint_Is_Not_Enveloped()
        {
            var client = _factory.CreateClient();

            var response = await client.GetAsync("/health");

            response.IsSuccessStatusCode.Should().BeTrue();
            var body = await ParseAsync(response);
            body.TryGetProperty("status", out _).Should().BeTrue();
            body.TryGetProperty("success", out _).Should().BeFalse();
        }

        [Fact]
        public async Task Swagger_Is_Not_Enveloped()
        {
            var client = _factory.CreateClient();

            var response = await client.GetAsync("/swagger/v1/swagger.json");

            response.IsSuccessStatusCode.Should().BeTrue();
            var body = await ParseAsync(response);
            body.TryGetProperty("info", out _).Should().BeTrue();
            body.TryGetProperty("success", out _).Should().BeFalse();
        }

        // ----- helpers -----

        private static StringContent JsonBody(object payload) =>
            new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        private static async Task<JsonElement> ParseAsync(HttpResponseMessage response)
        {
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }

        private async Task<HttpClient> AuthenticatedClientAsync(string email, string password)
        {
            var client = _factory.CreateClient();
            var login = await client.PostAsync("/api/v1/auth/login",
                JsonBody(new { email, password }));
            login.EnsureSuccessStatusCode();

            using var doc = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
            var token = doc.RootElement.GetProperty("data").GetProperty("token").GetString();

            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", token);
            return client;
        }
    }
}
