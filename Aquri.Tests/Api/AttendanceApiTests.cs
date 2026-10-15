using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class AttendanceApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public AttendanceApiTests(AquriApiFactory factory) : base(factory) { }

        private static object ClockIn(int propertyId = 1, int userId = 20, string userName = "Mike Chen") =>
            new
            {
                propertyId,
                userId,
                userName,
                checkIn = "2026-10-21T08:00:00"
            };

        [Fact]
        public async Task Create_Returns_201_Present_Record()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/attendance", JsonBody(ClockIn()));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            envelope.GetProperty("data").GetProperty("status").GetString().Should().Be("present");
            envelope.GetProperty("data").GetProperty("userName").GetString().Should().Be("Mike Chen");
        }

        [Fact]
        public async Task Create_Absent_Record_Works()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/attendance",
                JsonBody(new
                {
                    propertyId = 1,
                    userId = 21,
                    userName = "No Show",
                    checkIn = "2026-10-21T08:00:00",
                    status = "absent"
                }));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("status").GetString().Should().Be("absent");
        }

        [Fact]
        public async Task Create_Invalid_Status_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/attendance",
                JsonBody(new
                {
                    propertyId = 1,
                    userId = 22,
                    userName = "Confused",
                    checkIn = "2026-10-21T08:00:00",
                    status = "vacation"
                }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Get_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/attendance/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task List_Filters_By_UserId()
        {
            var client = await AdminClientAsync();
            await client.PostAsync("/api/v1/attendance", JsonBody(ClockIn(userId: 30, userName: "Filter Target")));
            await client.PostAsync("/api/v1/attendance", JsonBody(ClockIn(userId: 31, userName: "Other Person")));

            var response = await client.GetAsync("/api/v1/attendance?userId=31");
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data").EnumerateArray().ToList();

            data.Should().Contain(a => a.GetProperty("userName").GetString() == "Other Person");
            data.Should().NotContain(a => a.GetProperty("userName").GetString() == "Filter Target");
        }

        [Fact]
        public async Task ClockOut_Computes_Hours_And_Overtime()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/attendance",
                JsonBody(new
                {
                    propertyId = 1,
                    userId = 40,
                    userName = "Long Shift",
                    checkIn = "2026-10-21T08:00:00"
                }));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/attendance/{id}",
                JsonBody(new { checkOut = "2026-10-21T17:30:00" }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/attendance/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("hoursWorked").GetDecimal().Should().Be(9.5m);
            envelope.GetProperty("data").GetProperty("overtime").GetDecimal().Should().Be(1.5m);
        }

        [Fact]
        public async Task Double_ClockOut_Returns_400()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/attendance", JsonBody(ClockIn(userId: 41)));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var first = await client.PutAsync($"/api/v1/attendance/{id}",
                JsonBody(new { checkOut = "2026-10-21T17:00:00" }));
            first.StatusCode.Should().Be(HttpStatusCode.OK);

            var second = await client.PutAsync($"/api/v1/attendance/{id}",
                JsonBody(new { checkOut = "2026-10-21T18:00:00" }));
            second.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(second);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Status_Transitions_Present_To_Late_Then_OnLeave()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/attendance", JsonBody(ClockIn(userId: 42)));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var late = await client.PutAsync($"/api/v1/attendance/{id}",
                JsonBody(new { status = "late" }));
            late.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/attendance/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("status").GetString().Should().Be("late");

            var leave = await client.PutAsync($"/api/v1/attendance/{id}",
                JsonBody(new { status = "on_leave", notes = "Family matter" }));
            leave.StatusCode.Should().Be(HttpStatusCode.OK);

            get = await client.GetAsync($"/api/v1/attendance/{id}");
            envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("status").GetString().Should().Be("on_leave");
            envelope.GetProperty("data").GetProperty("notes").GetString().Should().Be("Family matter");
        }

        [Fact]
        public async Task Unsupported_Status_Transition_Returns_400()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/attendance",
                JsonBody(new
                {
                    propertyId = 1,
                    userId = 43,
                    userName = "Absent Person",
                    checkIn = "2026-10-21T08:00:00",
                    status = "absent"
                }));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/attendance/{id}",
                JsonBody(new { status = "present" }));

            update.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(update);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Delete_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/attendance", JsonBody(ClockIn(userId: 44, userName: "Temp Record")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var delete = await client.DeleteAsync($"/api/v1/attendance/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            var get = await client.GetAsync($"/api/v1/attendance/{id}");
            get.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task FrontDesk_Can_ClockIn_But_Cannot_Delete()
        {
            var client = await FrontDeskClientAsync();

            var create = await client.PostAsync("/api/v1/attendance", JsonBody(ClockIn(userId: 45)));
            create.StatusCode.Should().Be(HttpStatusCode.Created);

            var delete = await client.DeleteAsync("/api/v1/attendance/1");
            delete.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
