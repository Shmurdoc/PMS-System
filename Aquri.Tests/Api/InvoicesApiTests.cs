using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class InvoicesApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public InvoicesApiTests(AquriApiFactory factory) : base(factory) { }

        private async Task<int> CreateGuestAsync(HttpClient client, string email)
        {
            var response = await client.PostAsync("/api/v1/guests", JsonBody(new
            {
                name = "Invoice Guest",
                email,
                phone = "+27333333333",
                idNumber = "7903035800085",
                nationality = "South African"
            }));
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        private async Task<int> CreateInvoiceAsync(HttpClient client, int guestId)
        {
            var response = await client.PostAsync("/api/v1/invoices", JsonBody(new
            {
                propertyId = 1,
                guestId,
                bookingId = (int?)null,
                type = "booking",
                dueDate = "2026-11-15T00:00:00",
                discountAmount = 0m,
                notes = "WS2 delete test",
                createdBy = "ws2-invoice-tests",
                items = new[]
                {
                    new { description = "Room charge", quantity = 1, unitPrice = 1000m, taxRate = 0.15m, category = "room" }
                }
            }));
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        [Fact]
        public async Task Delete_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();
            var guestId = await CreateGuestAsync(client, "ws2.inv.bye@nexus.com");
            var invoiceId = await CreateInvoiceAsync(client, guestId);

            var delete = await client.DeleteAsync($"/api/v1/invoices/{invoiceId}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            (await client.GetAsync($"/api/v1/invoices/{invoiceId}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Delete_Unknown_Returns_404()
        {
            var client = await AdminClientAsync();

            (await client.DeleteAsync("/api/v1/invoices/999999")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task FrontDesk_Cannot_Delete_Invoice()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.DeleteAsync("/api/v1/invoices/1");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
