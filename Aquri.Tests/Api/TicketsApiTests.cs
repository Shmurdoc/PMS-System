using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class TicketsApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public TicketsApiTests(AquriApiFactory factory) : base(factory) { }

        private static object NewTicket(string title) =>
            new
            {
                propertyId = 1,
                reporterId = 1,
                title,
                description = "WS2 ticket lifecycle test",
                type = "issue",
                category = "maintenance",
                priority = "medium",
                roomId = (int?)null,
                guestId = (int?)null,
                dueDate = (string?)null,
                tags = new[] { "ws2" }
            };

        [Fact]
        public async Task Create_Then_Delete_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();

            var create = await client.PostAsync("/api/v1/tickets", JsonBody(NewTicket("Leaking tap")));
            create.StatusCode.Should().Be(HttpStatusCode.Created);
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var delete = await client.DeleteAsync($"/api/v1/tickets/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            (await client.GetAsync($"/api/v1/tickets/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Delete_Unknown_Returns_404()
        {
            var client = await AdminClientAsync();

            (await client.DeleteAsync("/api/v1/tickets/999999")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task FrontDesk_Cannot_Delete_Ticket()
        {
            var client = await FrontDeskClientAsync();

            var response = await client.DeleteAsync("/api/v1/tickets/1");

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
