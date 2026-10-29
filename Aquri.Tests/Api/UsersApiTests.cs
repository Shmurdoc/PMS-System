using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class UsersApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public UsersApiTests(AquriApiFactory factory) : base(factory) { }

        private static object NewUser(string email, string name = "WS2 Test User",
            string password = "secret123", string role = "housekeeping") =>
            new { email, name, password, role, department = "Housekeeping", phone = "+27123456789", propertyId = 1 };

        [Fact]
        public async Task List_As_Admin_Returns_Users_Without_Password_Fields()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/users");

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var raw = await response.Content.ReadAsStringAsync();
            raw.Should().NotContain("password", "the API must never project password material");
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").EnumerateArray()
                .Should().Contain(u => u.GetProperty("email").GetString() == "admin@nexus.com");
        }

        [Fact]
        public async Task FrontDesk_Can_List_But_Cannot_Write()
        {
            var client = await FrontDeskClientAsync();

            // The roster is open to every signed-in role — messaging needs to see
            // colleagues. The admin page stays gated in the UI; only writes are locked.
            (await client.GetAsync("/api/v1/users")).StatusCode.Should().Be(HttpStatusCode.OK);
            (await client.PostAsync("/api/v1/users", JsonBody(NewUser("fd.write@nexus.com"))))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await client.PutAsync("/api/v1/users/1",
                    JsonBody(new { name = "Nope", department = (string?)null, phone = (string?)null, role = (string?)null, password = (string?)null })))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await client.DeleteAsync("/api/v1/users/2")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Manager_Can_Manage_Staff_At_Own_Property_But_Not_Others()
        {
            var client = await ManagerClientAsync();

            // Manager can list the roster (messaging needs to see colleagues).
            (await client.GetAsync("/api/v1/users")).StatusCode.Should().Be(HttpStatusCode.OK);

            // Manager can create a staff account at their own property (property 1).
            (await client.PostAsync("/api/v1/users", JsonBody(NewUser("mgr.own@nexus.com"))))
                .StatusCode.Should().Be(HttpStatusCode.Created);

            // Manager cannot create a staff account at another property. The
            // pipeline behavior rejects a mismatched PropertyId before the
            // handler ever runs.
            var otherProperty = new
            {
                email = "mgr.other@nexus.com",
                name = "Other Property Staff",
                password = "secret123",
                role = "housekeeping",
                department = "Housekeeping",
                phone = "+27123456789",
                propertyId = 999
            };
            (await client.PostAsync("/api/v1/users", JsonBody(otherProperty)))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Manager_Cannot_Delete_Own_Account()
        {
            var client = await ManagerClientAsync();

            var me = await client.GetAsync("/api/v1/auth/me");
            using var meDoc = JsonDocument.Parse(await me.Content.ReadAsStringAsync());
            var managerId = meDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            (await client.DeleteAsync($"/api/v1/users/{managerId}"))
                .StatusCode.Should().Be(HttpStatusCode.Conflict);
        }

        [Fact]
        public async Task Get_Unknown_Returns_404()
        {
            var client = await AdminClientAsync();

            (await client.GetAsync("/api/v1/users/999999")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Create_Returns_201_Without_Hash_Then_New_Password_Logs_In()
        {
            var client = await AdminClientAsync();
            var email = "ws2.create@nexus.com";

            var create = await client.PostAsync("/api/v1/users", JsonBody(NewUser(email)));

            create.StatusCode.Should().Be(HttpStatusCode.Created);
            var raw = await create.Content.ReadAsStringAsync();
            raw.Should().NotContain("password");
            using var created = JsonDocument.Parse(raw);
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();
            id.Should().BeGreaterThan(0);
            created.RootElement.GetProperty("data").GetProperty("role").GetString().Should().Be("housekeeping");

            var login = await AuthenticatedClientAsync(email, "secret123");
            (await login.GetAsync("/api/v1/auth/me")).StatusCode.Should().Be(HttpStatusCode.OK);

            var delete = await client.DeleteAsync($"/api/v1/users/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);
            (await client.GetAsync($"/api/v1/users/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Create_Duplicate_Email_Returns_409_Conflict()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/users",
                JsonBody(NewUser("admin@nexus.com")));

            response.StatusCode.Should().Be(HttpStatusCode.Conflict);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("CONFLICT");
        }

        [Fact]
        public async Task Create_Invalid_Role_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/users",
                JsonBody(NewUser("ws2.badrole@nexus.com", role: "wizard")));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Create_Short_Password_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/users",
                JsonBody(NewUser("ws2.shortpw@nexus.com", password: "abc")));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Update_Changes_Profile_Empty_Password_Never_Breaks_Login()
        {
            var client = await AdminClientAsync();
            var email = "ws2.update@nexus.com";
            var create = await client.PostAsync("/api/v1/users", JsonBody(NewUser(email, name: "Before Rename")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/users/{id}", JsonBody(new
            {
                name = "After Rename",
                department = (string?)null,
                phone = (string?)null,
                role = (string?)null,
                password = ""
            }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/users/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("name").GetString().Should().Be("After Rename");

            var login = await AuthenticatedClientAsync(email, "secret123");
            (await login.GetAsync("/api/v1/auth/me")).StatusCode.Should().Be(HttpStatusCode.OK);

            await client.DeleteAsync($"/api/v1/users/{id}");
        }

        [Fact]
        public async Task Update_Invalid_Role_Returns_400()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/users", JsonBody(NewUser("ws2.badrole2@nexus.com")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var update = await client.PutAsync($"/api/v1/users/{id}", JsonBody(new
            {
                name = "Still Valid Name",
                department = (string?)null,
                phone = (string?)null,
                role = "wizard",
                password = (string?)null
            }));

            update.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(update);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");

            await client.DeleteAsync($"/api/v1/users/{id}");
        }

        [Fact]
        public async Task Delete_Own_Account_Returns_409_Conflict()
        {
            var client = await AdminClientAsync();

            var me = await client.GetAsync("/api/v1/auth/me");
            using var meDoc = JsonDocument.Parse(await me.Content.ReadAsStringAsync());
            var adminId = meDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var response = await client.DeleteAsync($"/api/v1/users/{adminId}");

            response.StatusCode.Should().Be(HttpStatusCode.Conflict);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("CONFLICT");
        }

        [Fact]
        public async Task Delete_User_Referenced_By_Shifts_Returns_409_Conflict()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/users",
                JsonBody(NewUser("ws2.shiftuser@nexus.com", name: "Shifted Staff")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var shift = await client.PostAsync("/api/v1/shifts", JsonBody(new
            {
                propertyId = 1,
                userId = id,
                userName = "Shifted Staff",
                startTime = "2026-10-21T08:00:00",
                endTime = "2026-10-21T17:00:00",
                role = "Housekeeping",
                department = "Housekeeping"
            }));
            shift.StatusCode.Should().Be(HttpStatusCode.Created);

            var response = await client.DeleteAsync($"/api/v1/users/{id}");

            response.StatusCode.Should().Be(HttpStatusCode.Conflict);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("CONFLICT");
        }

        [Fact]
        public async Task Delete_Unknown_Returns_404()
        {
            var client = await AdminClientAsync();

            (await client.DeleteAsync("/api/v1/users/999999")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
    }
}
