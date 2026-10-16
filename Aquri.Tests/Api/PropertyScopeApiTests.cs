using System.Net;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Aquri.Tests.Api
{
    /// <summary>
    /// End-to-end property scope: a JWT minted for a property-assigned user can
    /// only read its own property (403 FORBIDDEN envelope otherwise), while an
    /// unrestricted admin reaches any property. Also covers admin assignment of
    /// a property scope when creating an account.
    /// </summary>
    public class PropertyScopeApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public PropertyScopeApiTests(AquriApiFactory factory) : base(factory) { }

        private HttpClient ScopedClient(int propertyId)
        {
            using var scope = Factory.Services.CreateScope();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var tokens = scope.ServiceProvider.GetRequiredService<ITokenService>();

            var user = new User("scoped@nexus.com", "Scoped User", AppRoles.FrontDesk, hasher.Hash("scoped123"));
            user.AssignProperty(propertyId);

            var client = Factory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", tokens.CreateToken(user));
            return client;
        }

        [Fact]
        public async Task Scoped_User_Reads_Its_Own_Property()
        {
            var client = ScopedClient(1);

            var response = await client.GetAsync("/api/v1/bookings?propertyId=1");

            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task Scoped_User_Is_Forbidden_On_Another_Property()
        {
            var client = ScopedClient(1);

            var response = await client.GetAsync("/api/v1/bookings?propertyId=2");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("FORBIDDEN");
            envelope.GetProperty("error").GetProperty("message").GetString().Should().NotBeNullOrWhiteSpace();
        }

        [Fact]
        public async Task Scoped_User_Is_Forbidden_Without_A_Real_Property()
        {
            var client = ScopedClient(1);

            var response = await client.GetAsync("/api/v1/bookings?propertyId=0");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Unrestricted_Admin_Reads_Any_Property()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/bookings?propertyId=999");

            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task Admin_Creates_A_User_Scoped_To_A_Property()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/users", JsonBody(new
            {
                email = "scoped-create@nexus.com",
                name = "Scoped Create",
                password = "password1",
                role = "front_desk",
                propertyId = 7
            }));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("propertyId").GetInt32().Should().Be(7);
        }
    }
}
