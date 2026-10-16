using System;

namespace Aquri.Domain.Entities
{
    /// <summary>A staff comment on a ticket. Internal comments (e.g. "guest is a VIP, comp the breakfast") stay off the guest-facing view.</summary>
    public class TicketComment
    {
        public int Id { get; private set; }
        public int TicketId { get; private set; }
        public int UserId { get; private set; }
        public string UserName { get; private set; } = string.Empty;
        public string Content { get; private set; } = string.Empty;
        public bool IsInternal { get; private set; }
        public DateTime Created { get; private set; }

        public TicketComment() { }

        public TicketComment(int ticketId, int userId, string userName, string content, bool isInternal)
        {
            if (ticketId <= 0)
                throw new ArgumentException("TicketId must be positive.", nameof(ticketId));
            if (userId <= 0)
                throw new ArgumentException("UserId must be positive.", nameof(userId));
            if (string.IsNullOrWhiteSpace(userName))
                throw new ArgumentException("UserName cannot be empty.", nameof(userName));
            if (string.IsNullOrWhiteSpace(content))
                throw new ArgumentException("Comment content cannot be empty.", nameof(content));

            TicketId = ticketId;
            UserId = userId;
            UserName = userName.Trim();
            Content = content.Trim();
            IsInternal = isInternal;
            Created = DateTime.UtcNow;
        }
    }
}
