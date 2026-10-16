using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class RfidTagsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public RfidTagsApiTests(AquriApiFactory factory) : base(factory) { }

        private async Task<int> CreatePropertyAsync(HttpClient client, int tenantId)
        {
            var response = await client.PostAsync("/api/v1/properties",
                JsonBody(new
                {
                    name = $"Rfid Prop {tenantId}",
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

        private async Task<int> CreateGuestAsync(HttpClient client, string email)
        {
            var response = await client.PostAsync("/api/v1/guests", JsonBody(new
            {
                name = "Rfid Guest",
                email,
                phone = "+27222222222",
                idNumber = "8502025800082",
                nationality = "South African"
            }));
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
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
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        private async Task<int> FrontDeskUserIdAsync(HttpClient client)
        {
            var response = await client.GetAsync("/api/v1/users");
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            foreach (var user in doc.RootElement.GetProperty("data").EnumerateArray())
            {
                if (user.GetProperty("email").GetString() == "front@nexus.com")
                    return user.GetProperty("id").GetInt32();
            }
            throw new InvalidOperationException("Seeded front desk user not found.");
        }

        /// <summary>Mints a per-test badge holder so attendance records (keyed by user and day) never leak between tests that punch with server stamps.</summary>
        private async Task<int> CreateBadgeUserAsync(HttpClient client, string email)
        {
            var response = await client.PostAsync("/api/v1/users", JsonBody(new
            {
                email,
                name = "Front Desk",
                password = "secret123",
                role = "front_desk",
                department = "Front Desk",
                phone = "+27123456789"
            }));
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        private static object IssueStaff(int propertyId, int userId, string tagNumber) =>
            new
            {
                propertyId,
                kind = "staff",
                tagNumber,
                userId,
                bookingId = (int?)null,
                accessLevel = "staff",
                expiresAt = (DateTime?)null,
                notes = (string?)null
            };

        private static object IssueGuest(int propertyId, int bookingId, string tagNumber) =>
            new
            {
                propertyId,
                kind = "guest",
                tagNumber,
                userId = (int?)null,
                bookingId,
                accessLevel = (string?)null,
                expiresAt = (DateTime?)null,
                notes = (string?)null
            };

        private static object Tap(int propertyId, string tagNumber) =>
            new { propertyId, tagNumber };

        [Fact]
        public async Task Issue_Staff_Tag_Returns_201_And_List_Filters_By_Kind()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 711);
            var frontDeskId = await FrontDeskUserIdAsync(client);

            var response = await client.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueStaff(propertyId, frontDeskId, "RFID-711-STAFF-1")));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data");
            data.GetProperty("kind").GetString().Should().Be("staff");
            data.GetProperty("status").GetString().Should().Be("active");
            data.GetProperty("userId").GetInt32().Should().Be(frontDeskId);
            data.GetProperty("userName").GetString().Should().Be("Front Desk");
            data.GetProperty("accessLevel").GetString().Should().Be("staff");
            data.GetProperty("bookingId").ValueKind.Should().Be(JsonValueKind.Null);

            var staff = await ParseAsync(
                await client.GetAsync($"/api/v1/rfidtags?propertyId={propertyId}&kind=staff"));
            staff.GetProperty("data").EnumerateArray().Should().ContainSingle(t =>
                t.GetProperty("tagNumber").GetString() == "RFID-711-STAFF-1");

            var guests = await ParseAsync(
                await client.GetAsync($"/api/v1/rfidtags?propertyId={propertyId}&kind=guest"));
            guests.GetProperty("data").EnumerateArray().Should().BeEmpty();
        }

        [Fact]
        public async Task Issue_Guest_Tag_Defaults_Expiry_To_CheckOut_And_Carries_Stay_Context()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 712);
            var roomId = await CreateRoomAsync(client, propertyId, "920");
            var guestId = await CreateGuestAsync(client, "rfid.guest.712@nexus.com");
            var bookingId = await CreateBookingAsync(client, propertyId, roomId, guestId);

            var response = await client.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueGuest(propertyId, bookingId, "RFID-712-GUEST-1")));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data");
            data.GetProperty("kind").GetString().Should().Be("guest");
            data.GetProperty("guestName").GetString().Should().Be("Rfid Guest");
            data.GetProperty("roomNumber").GetString().Should().Be("920");
            data.GetProperty("expiresAt").GetDateTime().Date
                .Should().Be(new DateTime(2026, 12, 14));
            data.GetProperty("userId").ValueKind.Should().Be(JsonValueKind.Null);
        }

        [Fact]
        public async Task Issue_Duplicate_Tag_Number_Returns_409()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 713);
            var frontDeskId = await FrontDeskUserIdAsync(client);

            var first = await client.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueStaff(propertyId, frontDeskId, "RFID-713-DUP")));
            first.StatusCode.Should().Be(HttpStatusCode.Created);

            var duplicate = await client.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueStaff(propertyId, frontDeskId, "RFID-713-DUP")));

            duplicate.StatusCode.Should().Be(HttpStatusCode.Conflict);
            var envelope = await ParseAsync(duplicate);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("CONFLICT");
        }

        [Fact]
        public async Task Issue_As_FrontDesk_Returns_403()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.PostAsync("/api/v1/rfidtags",
                JsonBody(new { propertyId = 1, kind = "staff", tagNumber = "RFID-403" }));

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Staff_Tap_Toggles_In_Then_Out_And_Unknown_Tag_404s()
        {
            var admin = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(admin, 714);
            var frontDeskId = await CreateBadgeUserAsync(admin, "rfid.714.badge@nexus.com");
            await admin.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueStaff(propertyId, frontDeskId, "RFID-714-STAFF-1")));

            var frontDesk = await FrontDeskClientAsync();

            var clockIn = await frontDesk.PostAsync("/api/v1/rfidtags/tap/staff",
                JsonBody(Tap(propertyId, "RFID-714-STAFF-1")));
            clockIn.StatusCode.Should().Be(HttpStatusCode.OK);
            var inEnvelope = await ParseAsync(clockIn);
            var inData = inEnvelope.GetProperty("data");
            inData.GetProperty("punch").GetString().Should().Be("in");
            inData.GetProperty("userName").GetString().Should().Be("Front Desk");
            var attendanceId = inData.GetProperty("attendanceId").GetInt32();
            attendanceId.Should().BeGreaterThan(0);

            // The server stamps its own timestamps — wait out the 3s debounce
            // window so the second tap is a genuine clock-out.
            await Task.Delay(3200);

            var clockOut = await frontDesk.PostAsync("/api/v1/rfidtags/tap/staff",
                JsonBody(Tap(propertyId, "RFID-714-STAFF-1")));
            clockOut.StatusCode.Should().Be(HttpStatusCode.OK);
            var outEnvelope = await ParseAsync(clockOut);
            var outData = outEnvelope.GetProperty("data");
            outData.GetProperty("punch").GetString().Should().Be("out");
            outData.GetProperty("attendanceId").GetInt32().Should().Be(attendanceId);
            outData.GetProperty("checkOut").ValueKind.Should().NotBe(JsonValueKind.Null);

            var unknown = await frontDesk.PostAsync("/api/v1/rfidtags/tap/staff",
                JsonBody(Tap(propertyId, "RFID-714-NOPE")));
            unknown.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Guest_Tap_Resolves_Context_And_Staff_Tap_Rejects_Guest_Tag()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 715);
            var roomId = await CreateRoomAsync(client, propertyId, "921");
            var guestId = await CreateGuestAsync(client, "rfid.guest.715@nexus.com");
            var bookingId = await CreateBookingAsync(client, propertyId, roomId, guestId);
            await client.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueGuest(propertyId, bookingId, "RFID-715-GUEST-1")));

            var frontDesk = await FrontDeskClientAsync();

            var guestTap = await frontDesk.PostAsync("/api/v1/rfidtags/tap/guest",
                JsonBody(Tap(propertyId, "RFID-715-GUEST-1")));
            guestTap.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(guestTap);
            var data = envelope.GetProperty("data");
            data.GetProperty("guestName").GetString().Should().Be("Rfid Guest");
            data.GetProperty("roomNumber").GetString().Should().Be("921");
            data.GetProperty("bookingId").GetInt32().Should().Be(bookingId);
            data.GetProperty("bookingStatus").GetString().Should().NotBeNullOrEmpty();
            data.GetProperty("tagId").GetInt32().Should().BeGreaterThan(0);

            var staffTap = await frontDesk.PostAsync("/api/v1/rfidtags/tap/staff",
                JsonBody(Tap(propertyId, "RFID-715-GUEST-1")));
            staffTap.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var staffEnvelope = await ParseAsync(staffTap);
            staffEnvelope.GetProperty("error").GetProperty("message").GetString()
                .Should().Contain("not a staff badge");
        }

        [Fact]
        public async Task Revoke_Blocks_Taps_Double_Revoke_409s_And_FrontDesk_Cannot_Revoke()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 716);
            var frontDeskId = await FrontDeskUserIdAsync(client);
            var issue = await client.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueStaff(propertyId, frontDeskId, "RFID-716-STAFF-1")));
            using var created = JsonDocument.Parse(await issue.Content.ReadAsStringAsync());
            var tagId = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var revoke = await client.PostAsync($"/api/v1/rfidtags/{tagId}/revoke",
                JsonBody(new { notes = "Lost at conference." }));
            revoke.StatusCode.Should().Be(HttpStatusCode.OK);
            var revokeEnvelope = await ParseAsync(revoke);
            revokeEnvelope.GetProperty("data").GetProperty("status").GetString().Should().Be("blocked");

            var again = await client.PostAsync($"/api/v1/rfidtags/{tagId}/revoke",
                JsonBody(new { notes = (string?)null }));
            again.StatusCode.Should().Be(HttpStatusCode.Conflict);

            var frontDesk = await FrontDeskClientAsync();
            var blockedTap = await frontDesk.PostAsync("/api/v1/rfidtags/tap/staff",
                JsonBody(Tap(propertyId, "RFID-716-STAFF-1")));
            blockedTap.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var tapEnvelope = await ParseAsync(blockedTap);
            tapEnvelope.GetProperty("error").GetProperty("message").GetString()
                .Should().Contain("not active");

            var forbidden = await frontDesk.PostAsync($"/api/v1/rfidtags/{tagId}/revoke",
                JsonBody(new { notes = (string?)null }));
            forbidden.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Staff_Tap_Ignores_Client_Supplied_Timestamp()
        {
            var admin = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(admin, 721);
            var frontDeskId = await CreateBadgeUserAsync(admin, "rfid.721.badge@nexus.com");
            await admin.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueStaff(propertyId, frontDeskId, "RFID-721-STAFF-1")));

            var frontDesk = await FrontDeskClientAsync();
            var response = await frontDesk.PostAsync("/api/v1/rfidtags/tap/staff",
                JsonBody(new
                {
                    propertyId,
                    tagNumber = "RFID-721-STAFF-1",
                    tappedAt = "2026-12-01T08:00:00"
                }));

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data");
            data.GetProperty("punch").GetString().Should().Be("in");
            data.GetProperty("checkIn").GetDateTime().Date.Should().Be(DateTime.UtcNow.Date);
        }

        [Fact]
        public async Task Staff_Tap_Within_3s_Reports_Without_Toggling()
        {
            var admin = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(admin, 719);
            var frontDeskId = await CreateBadgeUserAsync(admin, "rfid.719.badge@nexus.com");
            await admin.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueStaff(propertyId, frontDeskId, "RFID-719-STAFF-1")));

            var frontDesk = await FrontDeskClientAsync();

            var first = await frontDesk.PostAsync("/api/v1/rfidtags/tap/staff",
                JsonBody(Tap(propertyId, "RFID-719-STAFF-1")));
            first.StatusCode.Should().Be(HttpStatusCode.OK);
            var firstData = (await ParseAsync(first)).GetProperty("data");
            firstData.GetProperty("punch").GetString().Should().Be("in");
            var firstAttendance = firstData.GetProperty("attendanceId").GetInt32();
            firstAttendance.Should().BeGreaterThan(0);

            var replay = await frontDesk.PostAsync("/api/v1/rfidtags/tap/staff",
                JsonBody(Tap(propertyId, "RFID-719-STAFF-1")));
            replay.StatusCode.Should().Be(HttpStatusCode.OK);
            var replayData = (await ParseAsync(replay)).GetProperty("data");
            replayData.GetProperty("punch").GetString().Should().Be("in");
            replayData.GetProperty("attendanceId").GetInt32().Should().Be(firstAttendance);
        }

        [Fact]
        public async Task Staff_Tap_At_Wrong_Property_404s()
        {
            var admin = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(admin, 720);
            var frontDeskId = await FrontDeskUserIdAsync(admin);
            await admin.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueStaff(propertyId, frontDeskId, "RFID-720-STAFF-1")));

            var frontDesk = await FrontDeskClientAsync();
            var response = await frontDesk.PostAsync("/api/v1/rfidtags/tap/staff",
                JsonBody(Tap(999998, "RFID-720-STAFF-1")));

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task List_With_Unknown_Kind_Returns_Empty()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 717);
            var frontDeskId = await FrontDeskUserIdAsync(client);
            await client.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueStaff(propertyId, frontDeskId, "RFID-717-STAFF-1")));

            var response = await client.GetAsync(
                $"/api/v1/rfidtags?propertyId={propertyId}&kind=visitor");

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").EnumerateArray().Should().BeEmpty();
        }

        [Fact]
        public async Task Issue_For_Unknown_Property_Returns_400()
        {
            var client = await AdminClientAsync();
            var frontDeskId = await FrontDeskUserIdAsync(client);

            var response = await client.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueStaff(999999, frontDeskId, "RFID-NO-PROP")));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("message").GetString()
                .Should().Contain("not found");
        }

        [Fact]
        public async Task Issue_Rejects_Overlong_Tag_Number_And_Notes()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 718);
            var frontDeskId = await FrontDeskUserIdAsync(client);

            var longTag = await client.PostAsync("/api/v1/rfidtags",
                JsonBody(IssueStaff(propertyId, frontDeskId, new string('X', 65))));
            longTag.StatusCode.Should().Be(HttpStatusCode.BadRequest);

            var longNotes = await client.PostAsync("/api/v1/rfidtags",
                JsonBody(new
                {
                    propertyId,
                    kind = "staff",
                    tagNumber = "RFID-718-NOTES",
                    userId = frontDeskId,
                    bookingId = (int?)null,
                    accessLevel = "staff",
                    expiresAt = (DateTime?)null,
                    notes = new string('n', 2001)
                }));
            longNotes.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }
    }
}
