using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class ShiftsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public ShiftsApiTests(AquriApiFactory factory) : base(factory) { }

        private static object NewShift(int propertyId = 1, int userId = 10, string userName = "Sarah Johnson") =>
            new
            {
                propertyId,
                userId,
                userName,
                startTime = "2026-10-20T08:00:00",
                endTime = "2026-10-20T17:00:00",
                role = "Front Desk",
                department = "Front Office"
            };

        [Fact]
        public async Task Create_Returns_201_With_Shift()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/shifts", JsonBody(NewShift()));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            envelope.GetProperty("data").GetProperty("userName").GetString().Should().Be("Sarah Johnson");
            envelope.GetProperty("data").GetProperty("status").GetString().Should().Be("scheduled");
            envelope.GetProperty("data").GetProperty("department").GetString().Should().Be("Front Office");
        }

        [Fact]
        public async Task Create_End_Before_Start_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/shifts",
                JsonBody(new
                {
                    propertyId = 1,
                    userId = 10,
                    userName = "Bad Hours",
                    startTime = "2026-10-20T17:00:00",
                    endTime = "2026-10-20T08:00:00",
                    role = "Front Desk"
                }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Get_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/shifts/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task List_Filters_By_Property()
        {
            var client = await AdminClientAsync();
            await client.PostAsync("/api/v1/shifts", JsonBody(NewShift(propertyId: 1, userName: "Prop One Shift")));
            await client.PostAsync("/api/v1/shifts", JsonBody(NewShift(propertyId: 2, userName: "Prop Two Shift")));

            var response = await client.GetAsync("/api/v1/shifts?propertyId=2");
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data").EnumerateArray().ToList();

            data.Should().Contain(s => s.GetProperty("userName").GetString() == "Prop Two Shift");
            data.Should().NotContain(s => s.GetProperty("userName").GetString() == "Prop One Shift");
        }

        [Fact]
        public async Task Update_Then_Get_Shows_Changes()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/shifts", JsonBody(NewShift()));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/shifts/{id}",
                JsonBody(new { notes = "Covering lunch rush", overtime = 1.5m }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/shifts/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("notes").GetString().Should().Be("Covering lunch rush");
            envelope.GetProperty("data").GetProperty("overtime").GetDecimal().Should().Be(1.5m);
        }

        [Fact]
        public async Task Update_Half_Break_Returns_400()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/shifts", JsonBody(NewShift()));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/shifts/{id}",
                JsonBody(new { breakStart = "2026-10-20T12:00:00" }));

            update.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(update);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Update_With_Break_Sets_Both_Ends()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/shifts", JsonBody(NewShift()));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/shifts/{id}",
                JsonBody(new { breakStart = "2026-10-20T12:00:00", breakEnd = "2026-10-20T12:30:00" }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/shifts/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("breakStart").GetString().Should().NotBeNull();
            envelope.GetProperty("data").GetProperty("breakEnd").GetString().Should().NotBeNull();
        }

        [Fact]
        public async Task Status_Change_Then_Invalid_Status_Returns_400()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/shifts", JsonBody(NewShift()));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var change = await client.PutAsync($"/api/v1/shifts/{id}/status",
                JsonBody(new { status = "completed" }));
            change.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/shifts/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("status").GetString().Should().Be("completed");

            var invalid = await client.PutAsync($"/api/v1/shifts/{id}/status",
                JsonBody(new { status = "on_moon" }));
            invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Swap_Moves_Shift_And_Completed_Cannot_Swap()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/shifts", JsonBody(NewShift(userName: "Alice")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var swap = await client.PutAsync($"/api/v1/shifts/{id}/swap",
                JsonBody(new { newStaffName = "Bob" }));
            swap.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/shifts/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("userName").GetString().Should().Be("Bob");
            envelope.GetProperty("data").GetProperty("swappedWith").GetString().Should().Be("Alice");
            envelope.GetProperty("data").GetProperty("status").GetString().Should().Be("swapped");

            var status = await client.PutAsync($"/api/v1/shifts/{id}/status",
                JsonBody(new { status = "completed" }));
            status.StatusCode.Should().Be(HttpStatusCode.OK);

            var swapAgain = await client.PutAsync($"/api/v1/shifts/{id}/swap",
                JsonBody(new { newStaffName = "Carol" }));
            swapAgain.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Delete_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/shifts", JsonBody(NewShift(userName: "Temp Shift")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var delete = await client.DeleteAsync($"/api/v1/shifts/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            var get = await client.GetAsync($"/api/v1/shifts/{id}");
            get.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task FrontDesk_Cannot_Create_Or_Delete_Shift()
        {
            var client = await FrontDeskClientAsync();

            var create = await client.PostAsync("/api/v1/shifts", JsonBody(NewShift()));
            create.StatusCode.Should().Be(HttpStatusCode.Forbidden);

            var delete = await client.DeleteAsync("/api/v1/shifts/1");
            delete.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
