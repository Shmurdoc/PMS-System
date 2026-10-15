using System.Net;
using System.Text.Json;

namespace Aquri.Tests.Api
{
    public class MessagesApiTests : ApiTestBase, IClassFixture<AquriApiFactory>
    {
        public MessagesApiTests(AquriApiFactory factory) : base(factory) { }

        private static object NewMessage(int propertyId = 1, string content = "Guest checked in at reception.") =>
            new { propertyId, content };

        [Fact]
        public async Task Create_Returns_201_And_Sender_Comes_From_Claims_Not_Body()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/messages",
                JsonBody(new { propertyId = 1, content = "Spoof attempt", senderId = 999, senderName = "Hacker" }));

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("data").GetProperty("senderName").GetString().Should().NotBe("Hacker");
            envelope.GetProperty("data").GetProperty("senderId").GetInt32().Should().NotBe(999);
            envelope.GetProperty("data").GetProperty("read").GetBoolean().Should().BeFalse();
            envelope.GetProperty("data").GetProperty("type").GetString().Should().Be("text");
        }

        [Fact]
        public async Task Create_DirectMessage_And_Channel_Post_RoundTrip()
        {
            var client = await AdminClientAsync();

            var dm = await client.PostAsync("/api/v1/messages",
                JsonBody(new { propertyId = 1, content = "DM to front desk", recipientId = 3, type = "alert" }));
            dm.StatusCode.Should().Be(HttpStatusCode.Created);

            var channel = await client.PostAsync("/api/v1/messages",
                JsonBody(new { propertyId = 1, content = "Channel post", channelId = "housekeeping" }));
            channel.StatusCode.Should().Be(HttpStatusCode.Created);

            using var created = JsonDocument.Parse(await channel.Content.ReadAsStringAsync());
            var channelId = created.RootElement.GetProperty("data").GetProperty("channelId").GetString();
            channelId.Should().Be("housekeeping");

            var list = await client.GetAsync("/api/v1/messages?recipientId=3");
            var envelope = await ParseAsync(list);
            envelope.GetProperty("data").EnumerateArray().Should().Contain(m =>
                m.GetProperty("type").GetString() == "alert");
        }

        [Fact]
        public async Task Create_Empty_Content_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/messages",
                JsonBody(new { propertyId = 1, content = "" }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var envelope = await ParseAsync(response);
            envelope.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION");
        }

        [Fact]
        public async Task Create_Invalid_Type_Returns_400()
        {
            var client = await AdminClientAsync();

            var response = await client.PostAsync("/api/v1/messages",
                JsonBody(new { propertyId = 1, content = "Hi", type = "meme" }));

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Get_Missing_Returns_404()
        {
            var client = await AdminClientAsync();

            var response = await client.GetAsync("/api/v1/messages/999999");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task UnreadOnly_List_Excludes_Read_Messages()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/messages", JsonBody(NewMessage(content: "Will be read")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();
            await client.PostAsync("/api/v1/messages", JsonBody(NewMessage(content: "Stays unread")));

            var read = await client.PutAsync($"/api/v1/messages/{id}/read", null);
            read.StatusCode.Should().Be(HttpStatusCode.OK);

            var list = await client.GetAsync("/api/v1/messages?unreadOnly=true");
            var envelope = await ParseAsync(list);
            var data = envelope.GetProperty("data").EnumerateArray().ToList();

            data.Should().Contain(m => m.GetProperty("content").GetString() == "Stays unread");
            data.Should().NotContain(m => m.GetProperty("content").GetString() == "Will be read");
        }

        [Fact]
        public async Task MarkRead_Then_Get_Shows_Read_True()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/messages", JsonBody(NewMessage(content: "Badge target")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var mark = await client.PutAsync($"/api/v1/messages/{id}/read", null);
            mark.StatusCode.Should().Be(HttpStatusCode.OK);

            var get = await client.GetAsync($"/api/v1/messages/{id}");
            var envelope = await ParseAsync(get);
            envelope.GetProperty("data").GetProperty("read").GetBoolean().Should().BeTrue();
        }

        [Fact]
        public async Task Delete_Returns_204_Then_404()
        {
            var client = await AdminClientAsync();
            var create = await client.PostAsync("/api/v1/messages", JsonBody(NewMessage(content: "Temp message")));
            using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
            var id = created.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var delete = await client.DeleteAsync($"/api/v1/messages/{id}");
            delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

            var get = await client.GetAsync($"/api/v1/messages/{id}");
            get.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task FrontDesk_Can_Send_But_Cannot_Delete()
        {
            var client = await FrontDeskClientAsync();

            var send = await client.PostAsync("/api/v1/messages", JsonBody(NewMessage(content: "From front desk")));
            send.StatusCode.Should().Be(HttpStatusCode.Created);

            var delete = await client.DeleteAsync("/api/v1/messages/1");
            delete.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
