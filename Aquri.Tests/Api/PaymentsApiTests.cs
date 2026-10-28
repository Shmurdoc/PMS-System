using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class PaymentsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public PaymentsApiTests(AquriApiFactory factory) : base(factory) { }

        private async Task<int> CreatePropertyAsync(HttpClient client, int tenantId)
        {
            var response = await client.PostAsync("/api/v1/properties",
                JsonBody(new
                {
                    name = $"Payment Prop {tenantId}",
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
            return doc.RootElement.GetProperty("data").GetProperty("propertyId").GetInt32();
        }

        private async Task<int> CreateGuestAsync(HttpClient client, string email, int propertyId)
        {
            var response = await client.PostAsync("/api/v1/guests", JsonBody(new
            {
                name = "Payment Guest",
                email,
                phone = "+27222222222",
                idNumber = "8502025800082",
                nationality = "South African",
                propertyId
            }));
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
        }

        private static object NewPayment(int propertyId, int guestId, string idempotencyKey,
            decimal amount = 1250m, string method = "card")
        {
            return new
            {
                propertyId,
                guestId,
                amount,
                method,
                processedBy = "api-test",
                idempotencyKey
            };
        }

        [Fact]
        public async Task CreatePayment_IdempotencyKey_ReturnsSamePayment_OnReplay()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 801);
            var guestId = await CreateGuestAsync(client, "ws2.pay.idem@nexus.com", propertyId);
            var key = "idem-pay-801-1";

            var create1 = await client.PostAsync("/api/v1/payments", JsonBody(NewPayment(propertyId, guestId, key)));
            create1.StatusCode.Should().Be(HttpStatusCode.Created);
            using var doc1 = JsonDocument.Parse(await create1.Content.ReadAsStringAsync());
            var id1 = doc1.RootElement.GetProperty("data").GetProperty("id").GetInt32();
            var number1 = doc1.RootElement.GetProperty("data").GetProperty("paymentNumber").GetString()!;

            // Replay with the same key — must return the same payment, not a duplicate.
            var create2 = await client.PostAsync("/api/v1/payments", JsonBody(NewPayment(propertyId, guestId, key)));
            create2.StatusCode.Should().Be(HttpStatusCode.Created);
            using var doc2 = JsonDocument.Parse(await create2.Content.ReadAsStringAsync());
            var id2 = doc2.RootElement.GetProperty("data").GetProperty("id").GetInt32();
            var number2 = doc2.RootElement.GetProperty("data").GetProperty("paymentNumber").GetString()!;

            id2.Should().Be(id1, "replaying an idempotency key must return the original payment");
            number2.Should().Be(number1, "replaying an idempotency key must return the same payment number");
        }

        [Fact]
        public async Task CreatePayment_DifferentAmount_SameKey_ReturnsFirstPayment()
        {
            var client = await AdminClientAsync();
            var propertyId = await CreatePropertyAsync(client, 802);
            var guestId = await CreateGuestAsync(client, "ws2.pay.diffamt@nexus.com", propertyId);
            var key = "idem-pay-802-1";

            var create1 = await client.PostAsync("/api/v1/payments", JsonBody(NewPayment(propertyId, guestId, key, amount: 1250m)));
            create1.StatusCode.Should().Be(HttpStatusCode.Created);
            using var doc1 = JsonDocument.Parse(await create1.Content.ReadAsStringAsync());
            var id1 = doc1.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Same key, different amount — key identifies the attempt, so the
            // original payment is returned (no double charge for a different amount).
            var create2 = await client.PostAsync("/api/v1/payments", JsonBody(NewPayment(propertyId, guestId, key, amount: 9999m)));
            create2.StatusCode.Should().Be(HttpStatusCode.Created);
            using var doc2 = JsonDocument.Parse(await create2.Content.ReadAsStringAsync());
            var id2 = doc2.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            id2.Should().Be(id1, "same idempotency key with different amount must not create a second payment");
        }
    }
}
