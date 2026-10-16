using System;

namespace Aquri.Domain.Entities
{
    /// <summary>A staff chat message — desk-to-maintenance, channel posts, system alerts. Read receipts drive the unread badge in the frontend.</summary>
    public class Message
    {
        public static readonly string[] ValidTypes = { "text", "system", "alert" };

        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public int SenderId { get; private set; }
        public string SenderName { get; private set; } = string.Empty;
        public string Content { get; private set; } = string.Empty;
        public DateTime Timestamp { get; private set; }
        public bool Read { get; private set; }
        public string? Avatar { get; private set; }
        public string? ChannelId { get; private set; }
        public string[] Attachments { get; private set; } = Array.Empty<string>();

        /// <summary>text | system | alert.</summary>
        public string Type { get; private set; } = "text";

        /// <summary>Set when the message is a direct message to one person; null for channel posts.</summary>
        public int? RecipientId { get; private set; }

        public Message() { }

        public Message(int propertyId, int senderId, string senderName, string content, string type)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (senderId <= 0)
                throw new ArgumentException("SenderId must be positive.", nameof(senderId));
            if (string.IsNullOrWhiteSpace(senderName))
                throw new ArgumentException("SenderName cannot be empty.", nameof(senderName));
            if (string.IsNullOrWhiteSpace(content))
                throw new ArgumentException("Content cannot be empty.", nameof(content));
            if (!ValidTypes.Contains(type))
                throw new ArgumentException($"Type must be one of: {string.Join(", ", ValidTypes)}.", nameof(type));

            PropertyId = propertyId;
            SenderId = senderId;
            SenderName = senderName.Trim();
            Content = content.Trim();
            Type = type;
            Timestamp = DateTime.UtcNow;
            Read = false;
        }

        /// <summary>Addresses the message to one person instead of a channel.</summary>
        public void SendTo(int recipientId)
        {
            if (recipientId <= 0)
                throw new ArgumentException("RecipientId must be positive.", nameof(recipientId));

            RecipientId = recipientId;
        }

        public void PostTo(string channelId)
        {
            if (string.IsNullOrWhiteSpace(channelId))
                throw new ArgumentException("ChannelId cannot be empty.", nameof(channelId));

            ChannelId = channelId.Trim();
        }

        public void MarkRead()
        {
            Read = true;
        }

        public void SetAttachments(string[] attachments)
        {
            Attachments = attachments ?? Array.Empty<string>();
        }
    }
}
