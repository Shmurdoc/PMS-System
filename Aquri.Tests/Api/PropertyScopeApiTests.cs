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
    /// <summary>End-to-end property scope: a JWT minted for a property-assigned user can only read its own property (403 FORBIDDEN envelope otherwise), while an unrestricted admin reaches any property. Also covers admin assignment of a property scope when creating an account.</summary>
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

        [Fact]
        public async Task Admin_Cannot_Create_A_Staff_Account_Without_A_Property()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/users", JsonBody(new
            {
                email = "no-property@nexus.com",
                name = "No Property",
                password = "password1",
                role = "front_desk"
            }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("message").GetString()
                .Should().Contain("PropertyId is required");
        }

        [Fact]
        public async Task Admin_Cannot_Create_A_Guest_Without_A_Property()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/guests", JsonBody(new
            {
                name = "No Property Guest",
                email = "no.property.guest@nexus.com",
                phone = "+27111111111",
                idNumber = "9001015800089",
                nationality = "South African"
            }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Scoped_Staff_Guest_Defaults_To_Its_Property()
        {
            var client = ScopedClient(1);

            var response = await client.PostAsync("/api/v1/guests", JsonBody(new
            {
                name = "Scoped Guest",
                email = "scoped.guest@nexus.com",
                phone = "+27111111111",
                idNumber = "9001015800089",
                nationality = "South African"
            }));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("propertyId").GetInt32().Should().Be(1);
        }

        [Fact]
        public async Task Scoped_Staff_Cannot_Read_Another_Propertys_Guest_By_Id()
        {
            var admin = await AdminClientAsync();
            var guestId = await CreateGuestAsync(admin, 7, "other.property.guest@nexus.com");

            var own = await ScopedClient(7).GetAsync($"/api/v1/guests/{guestId}");
            var other = await ScopedClient(1).GetAsync($"/api/v1/guests/{guestId}");

            own.StatusCode.Should().Be(HttpStatusCode.OK);
            other.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Scoped_Staff_Cannot_Change_Another_Propertys_Booking()
        {
            var admin = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(admin, 733);
            var roomId = await CreateRoomAsync(admin, propertyId, "973");
            var guestId = await CreateGuestAsync(admin, propertyId, "other.booking.guest@nexus.com");
            var bookingId = await CreateBookingAsync(admin, propertyId, roomId, guestId);

            var response = await ScopedClient(1).PatchAsync(
                $"/api/v1/bookings/{bookingId}/status",
                JsonBody("checked_in"));

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        private async Task<int> CreatePropertyAsync(HttpClient client, int tenantId)
        {
            var response = await client.PostAsync("/api/v1/properties", JsonBody(new
            {
                name = $"Isolation Prop {tenantId}",
                propertyId = tenantId,
                address = "1 Test Street",
                description = "",
                manager = (string?)null,
                rating = 0,
                phone = (string?)null,
                email = (string?)null,
                initialRooms = Array.Empty<object>()
            }));
            response.EnsureSuccessStatusCode();
            using var doc = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            // Everything downstream (rooms, guests, bookings, tags) points at the tenant id.
            return doc.RootElement.GetProperty("data").GetProperty("propertyId").GetInt32();
        }

        private async Task<int> CreateRoomAsync(HttpClient client, int propertyId, string number)
        {
            var response = await client.PostAsync("/api/v1/rooms",
                JsonBody(new { number, type = "double", propertyId, maxOccupancy = 2 }));
            response.EnsureSuccessStatusCode();
            using var doc = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        private async Task<int> CreateGuestAsync(HttpClient client, int propertyId, string email)
        {
            var response = await client.PostAsync("/api/v1/guests", JsonBody(new
            {
                name = "Isolation Guest",
                email,
                propertyId,
                phone = "+27222222222",
                idNumber = "8502025800082",
                nationality = "South African"
            }));
            response.EnsureSuccessStatusCode();
            using var doc = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        private async Task<int> CreateBookingAsync(HttpClient client, int propertyId, int roomId, int guestId)
        {
            var response = await client.PostAsync("/api/v1/bookings", JsonBody(new
            {
                propertyId,
                guestId,
                roomId,
                checkIn = "2026-12-10T00:00:00",
                checkOut = "2026-12-14T00:00:00",
                guests = 1,
                ratePerNight = 750m,
                source = "direct"
            }));
            response.EnsureSuccessStatusCode();
            using var doc = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }
    }
}
