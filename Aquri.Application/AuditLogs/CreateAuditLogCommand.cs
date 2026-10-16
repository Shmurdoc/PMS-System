using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.AuditLogs
{
    /// <summary>Records an audit trail entry. UserId/UserName/UserRole are stamped by the controller from the authenticated claims; IpAddress from the request context. Entries are immutable — there is no update or delete.</summary>
    public record CreateAuditLogCommand(
        int PropertyId,
        string Action,
        string EntityType,
        string EntityId,
        string EntityName,
        int? UserId,
        string? UserName,
        string? UserRole,
        string? Details,
        string? OldValue,
        string? NewValue,
        string? IpAddress) : IRequest<Result<AuditLogDto>>;

    public class CreateAuditLogHandler : IRequestHandler<CreateAuditLogCommand, Result<AuditLogDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateAuditLogHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<AuditLogDto>> Handle(CreateAuditLogCommand request, CancellationToken cancellationToken)
        {
            if (!request.UserId.HasValue || string.IsNullOrWhiteSpace(request.UserName))
                return Result<AuditLogDto>.Failure("User is required.");

            try
            {
                var log = new AuditLog(
                    request.PropertyId,
                    request.Action,
                    request.EntityType,
                    request.EntityId,
                    request.EntityName,
                    request.UserId.Value,
                    request.UserName,
                    request.UserRole ?? string.Empty,
                    request.Details ?? string.Empty);

                if (request.OldValue is not null || request.NewValue is not null)
                    log.RecordChange(request.OldValue, request.NewValue);

                if (!string.IsNullOrWhiteSpace(request.IpAddress))
                    log.SetIpAddress(request.IpAddress);

                _context.AuditLogs.Add(log);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<AuditLogDto>.SuccessResult(AuditLogDto.FromEntity(log));
            }
            catch (ArgumentException ex)
            {
                return Result<AuditLogDto>.Failure(ex.Message);
            }
        }
    }
}
