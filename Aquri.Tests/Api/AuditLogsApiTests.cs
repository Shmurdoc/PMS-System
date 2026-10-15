using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class AuditLogsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public AuditLogsApiTests(AquriApiFactory factory) : base(factory) { }

        private static object NewLog(
            int propertyId = 1,
            string action = "change_status",
            string entityType = "booking",
            string entityId = "42") =>
            new { propertyId, action, entityType, entityId, entityName = "Mokoena stay", details = "Checked in." };

        [Fact]
        public async Task Create_Returns_201_And_User_Comes_From_Claims_Not_Body()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/auditlogs",
                JsonBody(new { propertyId = 1, action = "login", entityType = "user", entityId = "1",
                    entityName = "Admin", details = "Signed in.",
                    userId = 999, userName = "Hacker", userRole = "superuser" }));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            var data = envelope.GetProperty("data");
            data.GetProperty("userName").GetString().Should().NotBe("Hacker");
            data.GetProperty("userId").GetInt32().Should().NotBe(999);
            data.GetProperty("userRole").GetString().Should().NotBe("superuser");
            data.GetProperty("timestamp").GetString().Should().NotBeNull();
        }

        [Fact]
        public async Task Create_WithChangeValues_StoresOldAndNew()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/auditlogs",
                JsonBody(new { propertyId = 1, action = "change_status", entityType = "room",
                    entityId = "7", entityName = "Room 101", details = "Status flip",
                    oldValue = "occupied", newValue = "vacant" }));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("oldValue").GetString().Should().Be("occupied");
            envelope.GetProperty("data").GetProperty("newValue").GetString().Should().Be("vacant");
        }

        [Fact]
        public async Task Create_UnknownEntityType_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/auditlogs",
                JsonBody(new { propertyId = 1, action = "do", entityType = "spaceship",
                    entityId = "1", entityName = "X", details = "d" }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Get_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/auditlogs/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task List_Filters_By_EntityType_And_Action()
        {
            var client = await AdminClientAsync();
            // create two entries with distinct shapes
            var booking = await client.PostAsync("/api/v1/auditlogs", JsonBody(NewLog(entityType: "booking")));
            booking.StatusCode.Should().Be(HttpStatusCode.Created);
            var payment = await client.PostAsync("/api/v1/auditlogs",
                JsonBody(new { propertyId = 1, action = "capture", entityType = "payment",
                    entityId = "55", entityName = "Card", details = "Captured" }));
            payment.StatusCode.Should().Be(HttpStatusCode.Created);

            var byType = await client.GetAsync("/api/v1/auditlogs?entityType=payment");
            var envelope = await ParseAsync(byType);
            var data = envelope.GetProperty("data").EnumerateArray().ToList();
            data.Should().NotBeEmpty();
            data.Should().OnlyContain(l => l.GetProperty("entityType").GetString() == "payment");

            var byAction = await client.GetAsync("/api/v1/auditlogs?action=capture");
            var actionEnvelope = await ParseAsync(byAction);
            actionEnvelope.GetProperty("data").EnumerateArray().Should().Contain(l =>
                l.GetProperty("entityId").GetString() == "55");

            using var paymentDoc = JsonDocument.Parse(await payment.Content.ReadAsStringAsync());
            var stampedUserId = paymentDoc.RootElement.GetProperty("data").GetProperty("userId").GetInt32();
            var byUser = await client.GetAsync($"/api/v1/auditlogs?userId={stampedUserId}");
            var userEnvelope = await ParseAsync(byUser);
            userEnvelope.GetProperty("data").EnumerateArray().Should().OnlyContain(l =>
                l.GetProperty("userId").GetInt32() == stampedUserId);
        }

        [Fact]
        public async Task Entries_Are_Immutable_No_Update_Or_Delete_Routes()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/auditlogs", JsonBody(NewLog()));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var put = await client.PutAsync($"/api/v1/auditlogs/{id}",
                JsonBody(new { details = "tampered" }));
            ((int)put.StatusCode).Should().BeGreaterThanOrEqualTo(400);

            var delete = await client.DeleteAsync($"/api/v1/auditlogs/{id}");
            ((int)delete.StatusCode).Should().BeGreaterThanOrEqualTo(400);

            var get = await client.GetAsync($"/api/v1/auditlogs/{id}");
            get.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task FrontDesk_Can_Read_But_Cannot_Write()
        {
            var client = await FrontDeskClientAsync();

            var list = await client.GetAsync("/api/v1/auditlogs");
            list.StatusCode.Should().Be(HttpStatusCode.OK);

            var create = await client.PostAsync("/api/v1/auditlogs", JsonBody(NewLog()));
            create.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
