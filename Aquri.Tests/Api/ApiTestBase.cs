using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    /// <summary>
    /// Shared helpers for HTTP-level API tests: envelope parsing, JSON bodies,
    /// and login as the seeded demo users (see <see cref="AquriApiFactory"/>).
    /// </summary>
    public abstract class ApiTestBase
    {
        protected readonly AquriApiFactory Factory;

        protected ApiTestBase(AquriApiFactory factory) => Factory = factory;

        protected static StringContent JsonBody(object payload) =>
            new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        protected static async Task<JsonElement> ParseAsync(HttpResponseMessage response)
        {
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }

        /// <summary>admin@nexus.com / manager@nexus.com / front@nexus.com + role suffix.</summary>
        protected async Task<HttpClient> AuthenticatedClientAsync(string email, string password)
        {
            var client = Factory.CreateClient();
            var login = await client.PostAsync("/api/v1/auth/login",
                JsonBody(new { email, password }));
            login.EnsureSuccessStatusCode();

            using var doc = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
            var token = doc.RootElement.GetProperty("data").GetProperty("token").GetString();

            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", token);
            return client;
        }

        protected Task<HttpClient> AdminClientAsync() =>
            AuthenticatedClientAsync("admin@nexus.com", "admin123");

        protected Task<HttpClient> ManagerClientAsync() =>
            AuthenticatedClientAsync("manager@nexus.com", "manager123");

        protected Task<HttpClient> FrontDeskClientAsync() =>
            AuthenticatedClientAsync("front@nexus.com", "front123");
    }
}
