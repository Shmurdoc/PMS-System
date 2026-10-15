using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.AuditLogs
{
    /// <summary>Fetches one audit log entry by id.</summary>
    public record GetAuditLogQuery(int Id) : IRequest<Result<AuditLogDto>>;

    public class GetAuditLogHandler : IRequestHandler<GetAuditLogQuery, Result<AuditLogDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetAuditLogHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<AuditLogDto>> Handle(GetAuditLogQuery request, CancellationToken cancellationToken)
        {
            var log = await _context.AuditLogs
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == request.Id, cancellationToken);

            return log is null
                ? Result<AuditLogDto>.NotFoundResult()
                : Result<AuditLogDto>.SuccessResult(AuditLogDto.FromEntity(log));
        }
    }

    /// <summary>Lists audit log entries, newest first, optionally filtered.</summary>
    public record GetAuditLogsQuery(
        int? PropertyId,
        string? EntityType,
        string? EntityId,
        int? UserId,
        string? Action) : IRequest<List<AuditLogDto>>;

    public class GetAuditLogsHandler : IRequestHandler<GetAuditLogsQuery, List<AuditLogDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetAuditLogsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<AuditLogDto>> Handle(GetAuditLogsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.AuditLogs.AsNoTracking().AsQueryable();

            if (request.PropertyId.HasValue)
                query = query.Where(l => l.PropertyId == request.PropertyId.Value);
            if (!string.IsNullOrWhiteSpace(request.EntityType))
                query = query.Where(l => l.EntityType == request.EntityType);
            if (!string.IsNullOrWhiteSpace(request.EntityId))
                query = query.Where(l => l.EntityId == request.EntityId);
            if (request.UserId.HasValue)
                query = query.Where(l => l.UserId == request.UserId.Value);
            if (!string.IsNullOrWhiteSpace(request.Action))
                query = query.Where(l => l.Action == request.Action);

            var logs = await query
                .OrderByDescending(l => l.Timestamp)
                .ThenByDescending(l => l.Id)
                .ToListAsync(cancellationToken);

            return logs.Select(AuditLogDto.FromEntity).ToList();
        }
    }
}
