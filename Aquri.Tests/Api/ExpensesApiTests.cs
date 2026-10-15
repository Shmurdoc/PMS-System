using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class ExpensesApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public ExpensesApiTests(AquriApiFactory factory) : base(factory) { }

        private static object ExpensePayload(
            int propertyId = 1,
            string category = "cleaning",
            decimal amount = 250m,
            string description = "Cleaning supplies",
            string? paymentMethod = "card",
            string? submittedBy = null) =>
            new
            {
                propertyId,
                category,
                amount,
                description,
                date = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
                vendor = "Cleaning Co",
                paymentMethod,
                notes = "Restock",
                submittedBy
            };

        private async Task<int> CreateExpenseAsync(HttpClient client, object? payload = null)
        {
            var response = await client.PostAsync("/api/v1/expenses", JsonBody(payload ?? ExpensePayload()));
            response.StatusCode.Should().Be(HttpStatusCode.Created);
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        [Fact]
        public async Task Create_Returns_201_Stamped_With_Submitter_From_Token()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/expenses",
                JsonBody(ExpensePayload(submittedBy: "Hacker")));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("success").GetBoolean().Should().BeTrue();
            var data = envelope.GetProperty("data");
            data.GetProperty("status").GetString().Should().Be("pending");
            data.GetProperty("submittedBy").GetString().Should().Be("Admin User");
        }

        [Fact]
        public async Task Approve_Flows_To_Approved_With_Approver_Stamped()
        {
            var manager = await ManagerClientAsync();
            var id = await CreateExpenseAsync(manager);

            var response = await manager.PostAsync($"/api/v1/expenses/{id}/approve", null);

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("status").GetString().Should().Be("approved");
            envelope.GetProperty("data").GetProperty("approvedBy").GetString().Should().Be("Manager User");
            envelope.GetProperty("data").GetProperty("approvedAt").ValueKind.Should().NotBe(JsonValueKind.Null);
        }

        [Fact]
        public async Task Approve_When_Not_Pending_Returns_400()
        {
            var admin = await AdminClientAsync();
            var id = await CreateExpenseAsync(admin);
            (await admin.PostAsync($"/api/v1/expenses/{id}/approve", null))
                .StatusCode.Should().Be(HttpStatusCode.OK);

            var second = await admin.PostAsync($"/api/v1/expenses/{id}/approve", null);
            second.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task FrontDesk_Cannot_Approve()
        {
            var admin = await AdminClientAsync();
            var id = await CreateExpenseAsync(admin);
            var frontDesk = await FrontDeskClientAsync();

            var response = await frontDesk.PostAsync($"/api/v1/expenses/{id}/approve", null);

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Update_Pending_Then_Get_Shows_Changes()
        {
            var client = await AdminClientAsync();
            var id = await CreateExpenseAsync(client);

            var update = await client.PutAsync($"/api/v1/expenses/{id}",
                JsonBody(new
                {
                    category = "maintenance",
                    amount = 480m,
                    description = "Replaced HVAC filter",
                    date = new DateTime(2026, 1, 20, 0, 0, 0, DateTimeKind.Utc),
                    vendor = (string?)null,
                    notes = "urgent",
                    receiptUrl = "https://cdn.example.com/receipt-42.pdf",
                    paymentMethod = "eft"
                }));
            update.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/expenses/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("category").GetString().Should().Be("maintenance");
            envelope.GetProperty("data").GetProperty("amount").GetDecimal().Should().Be(480m);
            envelope.GetProperty("data").GetProperty("paymentMethod").GetString().Should().Be("eft");
            envelope.GetProperty("data").GetProperty("receiptUrl").GetString().Should().Be("https://cdn.example.com/receipt-42.pdf");
            envelope.GetProperty("data").GetProperty("vendor").ValueKind.Should().Be(JsonValueKind.Null);
        }

        [Fact]
        public async Task Update_With_Invalid_PaymentMethod_Returns_400()
        {
            var client = await AdminClientAsync();
            var id = await CreateExpenseAsync(client);

            var update = await client.PutAsync($"/api/v1/expenses/{id}",
                JsonBody(new
                {
                    category = "cleaning",
                    amount = 100m,
                    description = "x",
                    date = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
                    vendor = (string?)null,
                    notes = (string?)null,
                    paymentMethod = "bitcoin"
                }));

            update.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Update_Approved_Expense_Returns_400()
        {
            var client = await AdminClientAsync();
            var id = await CreateExpenseAsync(client);
            (await client.PostAsync($"/api/v1/expenses/{id}/approve", null))
                .StatusCode.Should().Be(HttpStatusCode.OK);

            var update = await client.PutAsync($"/api/v1/expenses/{id}",
                JsonBody(new { category = "cleaning", amount = 1m, description = "x",
                    date = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc) }));

            update.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task List_Filters_By_Status()
        {
            var client = await AdminClientAsync();
            var first = await CreateExpenseAsync(client, ExpensePayload(amount: 100m));
            var second = await CreateExpenseAsync(client, ExpensePayload(amount: 200m));
            (await client.PostAsync($"/api/v1/expenses/{first}/approve", null))
                .StatusCode.Should().Be(HttpStatusCode.OK);

            var response = await client.GetAsync("/api/v1/expenses?status=approved");
            var envelope = await ParseAsync(response);
            var approved = envelope.GetProperty("data").EnumerateArray()
                .Where(e => e.GetProperty("id").GetInt32() == first || e.GetProperty("id").GetInt32() == second)
                .ToList();

            approved.Should().ContainSingle(e => e.GetProperty("id").GetInt32() == first);
            approved.Should().NotContain(e => e.GetProperty("id").GetInt32() == second);
        }

        [Fact]
        public async Task Delete_As_Admin_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();
            var id = await CreateExpenseAsync(client);

            var delete = await client.DeleteAsync($"/api/v1/expenses/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            (await client.GetAsync($"/api/v1/expenses/{id}"))
                .StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Manager_Cannot_Delete()
        {
            var admin = await AdminClientAsync();
            var id = await CreateExpenseAsync(admin);
            var manager = await ManagerClientAsync();

            (await manager.DeleteAsync($"/api/v1/expenses/{id}"))
                .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        [Fact]
        public async Task Get_Missing_Returns_404_With_NotFound_Code()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/expenses/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("NOT_FOUND");
        }
    }
}
