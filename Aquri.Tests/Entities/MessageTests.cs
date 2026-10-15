using Aquri.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class MessageTests
    {
        private static Message NewMessage() =>
            new(1, 2, "Sipho Dlamini", "Front desk here — guest in lobby 3.", "text");

        [Fact]
        public void Constructor_Defaults_To_Unread_Text()
        {
            var message = NewMessage();

            message.Read.Should().BeFalse();
            message.Type.Should().Be("text");
            message.Content.Should().Be("Front desk here — guest in lobby 3.");
            message.Attachments.Should().BeEmpty();
            message.RecipientId.Should().BeNull();
            message.ChannelId.Should().BeNull();
        }

        [Fact]
        public void Constructor_EmptyContent_Throws()
        {
            var act = () => new Message(1, 2, "Name", "   ", "text");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void Constructor_InvalidType_Throws()
        {
            var act = () => new Message(1, 2, "Name", "Hello", "meme");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void Constructor_EmptySender_Throws()
        {
            var act = () => new Message(1, 2, " ", "Hello", "text");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void SendTo_SetsRecipient()
        {
            var message = NewMessage();

            message.SendTo(7);

            message.RecipientId.Should().Be(7);
            message.ChannelId.Should().BeNull();
        }

        [Fact]
        public void SendTo_NonPositiveRecipient_Throws()
        {
            var message = NewMessage();

            var act = () => message.SendTo(0);

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void PostTo_SetsChannel()
        {
            var message = NewMessage();

            message.PostTo(" housekeeping ");

            message.ChannelId.Should().Be("housekeeping");
        }

        [Fact]
        public void MarkRead_SetsReadFlag()
        {
            var message = NewMessage();

            message.MarkRead();

            message.Read.Should().BeTrue();
        }

        [Fact]
        public void SetAttachments_Null_Becomes_Empty_Array()
        {
            var message = NewMessage();

            message.SetAttachments(null!);

            message.Attachments.Should().BeEmpty();
        }

        [Fact]
        public void SetAttachments_Keeps_Values()
        {
            var message = NewMessage();

            message.SetAttachments(new[] { "/files/pump-diagram.png" });

            message.Attachments.Should().ContainSingle().Which.Should().Be("/files/pump-diagram.png");
        }
    }
}
