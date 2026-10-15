using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class GuestsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public GuestsApiTests(AquriApiFactory factory) : base(factory) { }

        private static object NewGuest(string email, string name = "WS2 Guest") =>
            new { name, email, phone = "+27111111111", idNumber = "9001015800089", nationality = "South African" };

        private async Task<int> CreateGuestAsync(HttpClient client, string email)
        {
            var response = await client.PostAsync("/api/v1/guests", JsonBody(NewGuest(email)));
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        private async Task<int> CreatePropertyAsync(HttpClient client, int tenantId)
        {
            var response = await client.PostAsync("/api/v1/properties",
                JsonBody(new
                {
                    name = $"Guests Prop {tenantId}",
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
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        private async Task<int> CreateRoomAsync(HttpClient client, int propertyId, string number)
        {
            var response = await client.PostAsync("/api/v1/rooms",
                JsonBody(new { number, type = "double", propertyId, maxOccupancy = 2 }));
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        [Fact]
        public async Task Delete_Unreferenced_Guest_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();
            var guestId = await CreateGuestAsync(client, "ws2.lonely@nexus.com");

            var delete = await client.DeleteAsync($"/api/v1/guests/{guestId}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            (await client.GetAsync($"/api/v1/guests/{guestId}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Delete_Guest_With_Booking_Returns_409_Conflict()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 601);
            var roomId = await CreateRoomAsync(client, propertyId, "901");
            var guestId = await CreateGuestAsync(client, "ws2.booked@nexus.com");

            var booking = await client.PostAsync("/api/v1/bookings", JsonBody(new
            {
                propertyId,
                guestId,
                roomId,
                checkIn = "2026-12-01T00:00:00",
                checkOut = "2026-12-05T00:00:00",
                guests = 1,
                ratePerNight = 500m,
                source = "direct"
            }));
            booking.StatusCode.Should().Be(HttpStatusCode.Created);

            var response = await client.DeleteAsync($"/api/v1/guests/{guestId}");

            response.StatusCode.Should().Be(HttpStatusCode.Conflict);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("CONFLICT");

            (await client.GetAsync($"/api/v1/guests/{guestId}")).StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task Delete_Unknown_Returns_404()
        {
            var client = await AdminClientAsync();

            (await client.DeleteAsync("/api/v1/guests/999999")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task FrontDesk_Cannot_Delete_Guest()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.DeleteAsync("/api/v1/guests/1");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
