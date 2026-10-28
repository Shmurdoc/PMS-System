using System;

namespace Aquri.Domain.Entities
{
    /// <summary>An immutable audit trail entry — who did what to which entity, when, and what changed. Write-only: nothing in the system ever edits or deletes an audit record.</summary>
    public class AuditLog
    {
        public static readonly string[] ValidEntityTypes =
            { "booking", "guest", "room", "invoice", "payment", "ticket", "user", "property", "expense", "inventory", "workflow" };

        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public string Action { get; private set; } = string.Empty;

        /// <summary>booking | guest | room | invoice | payment | ticket | user | property | expense | inventory | workflow.</summary>
        public string EntityType { get; private set; } = string.Empty;
        public string EntityId { get; private set; } = string.Empty;
        public string EntityName { get; private set; } = string.Empty;

        public int UserId { get; private set; }
        public string UserName { get; private set; } = string.Empty;
        public string UserRole { get; private set; } = string.Empty;
        public string Details { get; private set; } = string.Empty;

        public string? OldValue { get; private set; }
        public string? NewValue { get; private set; }
        public string? IpAddress { get; private set; }
        public DateTime Timestamp { get; private set; }

        public AuditLog() { }

        public AuditLog(
            int? propertyId, string action, string entityType, string entityId, string entityName,
            int userId, string userName, string userRole, string details)
        {
            if (propertyId.HasValue && propertyId.Value <= 0)
                throw new ArgumentException("PropertyId must be positive when supplied.", nameof(propertyId));
            if (string.IsNullOrWhiteSpace(action))
                throw new ArgumentException("Action cannot be empty.", nameof(action));
            if (!ValidEntityTypes.Contains(entityType))
                throw new ArgumentException($"EntityType must be one of: {string.Join(", ", ValidEntityTypes)}.", nameof(entityType));
            if (string.IsNullOrWhiteSpace(entityId))
                throw new ArgumentException("EntityId cannot be empty.", nameof(entityId));
            if (userId <= 0)
                throw new ArgumentException("UserId must be positive.", nameof(userId));
            if (string.IsNullOrWhiteSpace(userName))
                throw new ArgumentException("UserName cannot be empty.", nameof(userName));

            PropertyId = propertyId ?? 0;
            Action = action.Trim();
            EntityType = entityType;
            EntityId = entityId.Trim();
            EntityName = entityName?.Trim() ?? string.Empty;
            UserId = userId;
            UserName = userName.Trim();
            UserRole = userRole?.Trim() ?? string.Empty;
            Details = details?.Trim() ?? string.Empty;
            Timestamp = DateTime.UtcNow;
        }

        /// <summary>Captures an old→new value change, e.g. a status flip.</summary>
        public void RecordChange(string? oldValue, string? newValue)
        {
            OldValue = oldValue;
            NewValue = newValue;
        }

        public void SetIpAddress(string? ipAddress)
        {
            IpAddress = ipAddress;
        }
    }
}
