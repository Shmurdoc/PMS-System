using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class BookingsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public BookingsApiTests(AquriApiFactory factory) : base(factory) { }

        private async Task<int> CreatePropertyAsync(HttpClient client, int tenantId)
        {
            var response = await client.PostAsync("/api/v1/properties",
                JsonBody(new
                {
                    name = $"Booking Prop {tenantId}",
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
            // Everything downstream (rooms, guests, bookings, tags) points at the tenant id.
            return doc.RootElement.GetProperty("data").GetProperty("propertyId").GetInt32();
        }

        private async Task<int> CreateRoomAsync(HttpClient client, int propertyId, string number)
        {
            var response = await client.PostAsync("/api/v1/rooms",
                JsonBody(new { number, type = "double", propertyId, maxOccupancy = 2 }));
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        private async Task<int> CreateGuestAsync(HttpClient client, string email, int propertyId)
        {
            var response = await client.PostAsync("/api/v1/guests", JsonBody(new
            {
                name = "Booking Guest",
                email,
                propertyId,
                phone = "+27222222222",
                idNumber = "8502025800082",
                nationality = "South African"
            }));
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        private async Task<int> CreateBookingAsync(HttpClient client, int propertyId, int roomId, int guestId,
            string checkIn, string checkOut)
        {
            var response = await client.PostAsync("/api/v1/bookings", JsonBody(new
            {
                propertyId,
                guestId,
                roomId,
                checkIn,
                checkOut,
                guests = 1,
                ratePerNight = 750m,
                source = "direct"
            }));
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        private async Task<string> GetRoomStatusAsync(HttpClient client, int roomId)
        {
            var response = await client.GetAsync($"/api/v1/rooms/{roomId}");
            response.EnsureSuccessStatusCode();
            var envelope = await ParseAsync(response);
            return envelope.GetProperty("data").GetProperty("status").GetString()!;
        }

        [Fact]
        public async Task Delete_Returns_204_Then_404_And_Frees_Room()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 701);
            var roomId = await CreateRoomAsync(client, propertyId, "910");
            var guestId = await CreateGuestAsync(client, "ws2.bk.free@nexus.com", propertyId);
            var bookingId = await CreateBookingAsync(client, propertyId, roomId, guestId,
                "2026-12-10T00:00:00", "2026-12-14T00:00:00");

            (await GetRoomStatusAsync(client, roomId)).Should().Be("occupied");

            var delete = await client.DeleteAsync($"/api/v1/bookings/{bookingId}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            (await client.GetAsync($"/api/v1/bookings/{bookingId}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await GetRoomStatusAsync(client, roomId)).Should().Be("available");
        }

        [Fact]
        public async Task Delete_Keeps_Room_Occupied_While_After_Active_Booking_Remains()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 702);
            var roomId = await CreateRoomAsync(client, propertyId, "911");
            var guestA = await CreateGuestAsync(client, "ws2.bk.a@nexus.com", propertyId);
            var guestB = await CreateGuestAsync(client, "ws2.bk.b@nexus.com", propertyId);
            var bookingA = await CreateBookingAsync(client, propertyId, roomId, guestA,
                "2026-12-10T00:00:00", "2026-12-14T00:00:00");
            await CreateBookingAsync(client, propertyId, roomId, guestB,
                "2026-12-20T00:00:00", "2026-12-24T00:00:00");

            var delete = await client.DeleteAsync($"/api/v1/bookings/{bookingA}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            (await GetRoomStatusAsync(client, roomId)).Should().Be("occupied");
        }

        [Fact]
        public async Task Delete_Unknown_Returns_404()
        {
            var client = await AdminClientAsync();

            (await client.DeleteAsync("/api/v1/bookings/999999")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task FrontDesk_Cannot_Delete_Booking()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.DeleteAsync("/api/v1/bookings/1");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task CreateBooking_OverlappingDates_Returns409()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 901);
            var roomId = await CreateRoomAsync(client, propertyId, "920");
            var guestId = await CreateGuestAsync(client, "ws2.bk.overlap@nexus.com", propertyId);

            // First booking: Oct 30 - Nov 2
            var booking1 = await client.PostAsync("/api/v1/bookings", JsonBody(new
            {
                propertyId,
                guestId,
                roomId,
                checkIn = "2026-10-30T14:00:00",
                checkOut = "2026-11-02T11:00:00",
                guests = 1,
                ratePerNight = 750m,
                source = "direct"
            }));
            booking1.StatusCode.Should().Be(HttpStatusCode.Created);

            // Overlapping second booking -> 409
            var booking2 = await client.PostAsync("/api/v1/bookings", JsonBody(new
            {
                propertyId,
                guestId,
                roomId,
                checkIn = "2026-10-31T10:00:00",
                checkOut = "2026-11-01T10:00:00",
                guests = 1,
                ratePerNight = 750m,
                source = "direct"
            }));
            booking2.StatusCode.Should().Be(HttpStatusCode.Conflict);

            // Back-to-back (check-out == check-in) is allowed: tstzrange '[)'
            // excludes the upper bound, and the exclusion constraint mirrors it.
            var booking3 = await client.PostAsync("/api/v1/bookings", JsonBody(new
            {
                propertyId,
                guestId,
                roomId,
                checkIn = "2026-11-02T11:00:00",
                checkOut = "2026-11-05T11:00:00",
                guests = 1,
                ratePerNight = 750m,
                source = "direct"
            }));
            booking3.StatusCode.Should().Be(HttpStatusCode.Created);

            // Cleanup
            using var doc1 = JsonDocument.Parse(await booking1.Content.ReadAsStringAsync());
            var id1 = doc1.RootElement.GetProperty("data").GetProperty("id").GetInt32();
            using var doc3 = JsonDocument.Parse(await booking3.Content.ReadAsStringAsync());
            var id3 = doc3.RootElement.GetProperty("data").GetProperty("id").GetInt32();
            await client.DeleteAsync($"/api/v1/bookings/{id1}");
            await client.DeleteAsync($"/api/v1/bookings/{id3}");
        }
    }
}
