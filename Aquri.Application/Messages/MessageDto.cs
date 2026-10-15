using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.Messages
{
    /// <summary>Staff chat message as returned by the API — shaped for the frontend inbox.</summary>
    public class MessageDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public int SenderId { get; init; }
        public string SenderName { get; init; } = string.Empty;
        public string Content { get; init; } = string.Empty;
        public DateTime Timestamp { get; init; }
        public bool Read { get; init; }
        public string? Avatar { get; init; }
        public string? ChannelId { get; init; }
        public string[] Attachments { get; init; } = Array.Empty<string>();
        public string Type { get; init; } = "text";
        public int? RecipientId { get; init; }

        public static MessageDto FromEntity(Message message) => new()
        {
            Id = message.Id,
            PropertyId = message.PropertyId,
            SenderId = message.SenderId,
            SenderName = message.SenderName,
            Content = message.Content,
            Timestamp = message.Timestamp,
            Read = message.Read,
            Avatar = message.Avatar,
            ChannelId = message.ChannelId,
            Attachments = message.Attachments,
            Type = message.Type,
            RecipientId = message.RecipientId
        };
    }
}
