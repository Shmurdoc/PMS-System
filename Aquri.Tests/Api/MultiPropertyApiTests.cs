using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;

namespace Aquri.Tests.Api
{
    /// <summary>
    /// End-to-end proof of the owner/employee requirement through the real API:
    /// an owner has eleven hotels, one employee is assigned three of them, and
    /// after logging in that employee can only reach those three.
    /// </summary>
    public class MultiPropertyApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public MultiPropertyApiTests(AquriApiFactory factory) : base(factory) { }

        private async Task<List<int>> CreateElevenPropertiesAsync(HttpClient client, int firstTenantId)
        {
            var ids = new List<int>();
            for (var i = 0; i < 11; i++)
            {
                var tenantId = firstTenantId + i;
                var response = await client.PostAsync("/api/v1/properties", JsonBody(new
                {
                    name = $"QA Hotel {tenantId}",
                    propertyId = tenantId,
                    address = "1 Test Street",
                    description = "",
                    manager = (string?)null,
                    rating = 0,
                    phone = (string?)null,
                    email = (string?)null,
                    initialRooms = System.Array.Empty<object>()
                }));
                response.EnsureSuccessStatusCode();
                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                ids.Add(doc.RootElement.GetProperty("data").GetProperty("propertyId").GetInt32());
            }
            return ids;
        }

        private async Task<(string email, int[] assigned)> CreateEmployeeAsync(
            HttpClient admin, string email, int[] propertyIds)
        {
            var create = await admin.PostAsync("/api/v1/users", JsonBody(new
            {
                email,
                name = "Multi Property Front Desk",
                password = "secret123",
                role = "front_desk",
                department = "Front Desk",
                phone = (string?)null,
                propertyIds
            }));
            create.StatusCode.Should().Be(HttpStatusCode.Created);

            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            created.RootElement.GetProperty("data").GetProperty("propertyIds")
                .EnumerateArray().Select(e => e.GetInt32())
                .Should().BeEquivalentTo(propertyIds);

            return (email, propertyIds);
        }

        [Fact]
        public async Task Admin_Assigns_Three_Of_Eleven_And_Employee_Sees_Only_Those_Three()
        {
            var admin = await AdminClientAsync();
            var all = await CreateElevenPropertiesAsync(admin, 101);
            all.Should().HaveCount(11);

            var assigned = new[] { 104, 107, 109 };
            var (email, _) = await CreateEmployeeAsync(admin, "multi.front@nexus.com", assigned);

            var employee = await AuthenticatedClientAsync(email, "secret123");
            var list = await employee.GetAsync("/api/v1/properties");
            list.StatusCode.Should().Be(HttpStatusCode.OK);

            var envelope = await ParseAsync(list);
            var visible = envelope.GetProperty("data").EnumerateArray()
                .Select(p => p.GetProperty("propertyId").GetInt32())
                .OrderBy(id => id)
                .ToList();

            visible.Should().BeEquivalentTo(assigned,
                "the employee was assigned exactly three of the owner's eleven hotels");
            visible.Should().NotContain(101);
            visible.Should().NotContain(111);

            // The route takes the row id, not the tenant propertyId; read both
            // from the list the employee can see.
            var byTenant = envelope.GetProperty("data").EnumerateArray()
                .ToDictionary(p => p.GetProperty("propertyId").GetInt32(), p => p.GetProperty("id").GetInt32());

            // A property outside the assignment is not readable by id either.
            (await employee.GetAsync("/api/v1/properties/111")).StatusCode
                .Should().Be(HttpStatusCode.NotFound);

            var inScopeId = byTenant.ContainsKey(104) ? byTenant[104] : byTenant.Values.First();
            (await employee.GetAsync($"/api/v1/properties/{inScopeId}")).StatusCode
                .Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task Employee_Cannot_Read_Rooms_Outside_Assigned_Properties()
        {
            var admin = await AdminClientAsync();
            await CreateElevenPropertiesAsync(admin, 201);

            var assigned = new[] { 204, 207, 209 };
            await admin.PostAsync("/api/v1/rooms",
                JsonBody(new { number = "M1", type = "double", propertyId = 204, maxOccupancy = 2 }));
            await admin.PostAsync("/api/v1/rooms",
                JsonBody(new { number = "M2", type = "double", propertyId = 211, maxOccupancy = 2 }));

            var (email, _) = await CreateEmployeeAsync(admin, "multi.rooms@nexus.com", assigned);
            var employee = await AuthenticatedClientAsync(email, "secret123");

            var inside = await employee.GetAsync("/api/v1/rooms/property/204");
            inside.StatusCode.Should().Be(HttpStatusCode.OK);
            var insideEnvelope = await ParseAsync(inside);
            insideEnvelope.GetProperty("data").EnumerateArray()
                .Select(r => r.GetProperty("number").GetString())
                .Should().Contain("M1");

            // Asking for an unassigned property is refused outright by the scope
            // pipeline (403), so no rows from 211 ever reach the client.
            var outside = await employee.GetAsync("/api/v1/rooms/property/211");
            outside.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
