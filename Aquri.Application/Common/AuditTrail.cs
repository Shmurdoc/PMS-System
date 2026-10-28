using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;

namespace Aquri.Application.Common
{
    /// <summary>Writes an audit-log row for a money or staff mutation. Call inside the
    /// handler before <see cref="IApplicationDbContext.SaveChangesAsync"/> so the
    /// audit row commits in the same transaction as the change it describes.</summary>
    public static class AuditTrail
    {
        public static void Write(
            IApplicationDbContext context,
            ICurrentUser currentUser,
            string action,
            string entityType,
            string entityId,
            string entityName,
            string? oldValue = null,
            string? newValue = null)
        {
            var log = new AuditLog(
                currentUser.PropertyId,
                action,
                entityType,
                entityId,
                entityName,
                currentUser.UserId,
                currentUser.UserName,
                currentUser.UserRole,
                details: string.Empty);
            log.RecordChange(oldValue, newValue);
            context.AuditLogs.Add(log);
        }
    }
}
