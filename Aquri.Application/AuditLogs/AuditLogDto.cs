using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.AuditLogs
{
    /// <summary>Immutable audit trail entry as returned by the API.</summary>
    public class AuditLogDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public string Action { get; init; } = string.Empty;
        public string EntityType { get; init; } = string.Empty;
        public string EntityId { get; init; } = string.Empty;
        public string EntityName { get; init; } = string.Empty;
        public int UserId { get; init; }
        public string UserName { get; init; } = string.Empty;
        public string UserRole { get; init; } = string.Empty;
        public string Details { get; init; } = string.Empty;
        public string? OldValue { get; init; }
        public string? NewValue { get; init; }
        public string? IpAddress { get; init; }
        public DateTime Timestamp { get; init; }

        public static AuditLogDto FromEntity(AuditLog log) => new()
        {
            Id = log.Id,
            PropertyId = log.PropertyId,
            Action = log.Action,
            EntityType = log.EntityType,
            EntityId = log.EntityId,
            EntityName = log.EntityName,
            UserId = log.UserId,
            UserName = log.UserName,
            UserRole = log.UserRole,
            Details = log.Details,
            OldValue = log.OldValue,
            NewValue = log.NewValue,
            IpAddress = log.IpAddress,
            Timestamp = log.Timestamp
        };
    }
}
