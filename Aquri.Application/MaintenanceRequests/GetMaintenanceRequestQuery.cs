using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.MaintenanceRequests
{
    public record GetMaintenanceRequestQuery(int Id) : IRequest<Result<MaintenanceRequestDto>>;

    public class GetMaintenanceRequestHandler : IRequestHandler<GetMaintenanceRequestQuery, Result<MaintenanceRequestDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetMaintenanceRequestHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<MaintenanceRequestDto>> Handle(GetMaintenanceRequestQuery request, CancellationToken cancellationToken)
        {
            var maintenance = await _context.MaintenanceRequests
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken);

            return maintenance is null
                ? Result<MaintenanceRequestDto>.NotFoundResult()
                : Result<MaintenanceRequestDto>.SuccessResult(MaintenanceRequestDto.FromEntity(maintenance));
        }
    }

    /// <summary>Lists maintenance requests, optionally filtered by property, status, and priority.</summary>
    public record GetMaintenanceRequestsQuery(int? PropertyId, string? Status, string? Priority) : IRequest<List<MaintenanceRequestDto>>;

    public class GetMaintenanceRequestsHandler : IRequestHandler<GetMaintenanceRequestsQuery, List<MaintenanceRequestDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetMaintenanceRequestsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<MaintenanceRequestDto>> Handle(GetMaintenanceRequestsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.MaintenanceRequests.AsNoTracking().AsQueryable();

            if (request.PropertyId.HasValue)
                query = query.Where(m => m.PropertyId == request.PropertyId.Value);
            if (!string.IsNullOrWhiteSpace(request.Status))
                query = query.Where(m => m.Status == request.Status);
            if (!string.IsNullOrWhiteSpace(request.Priority))
                query = query.Where(m => m.Priority == request.Priority);

            var requests = await query
                .OrderByDescending(m => m.Created)
                .ToListAsync(cancellationToken);

            return requests.Select(MaintenanceRequestDto.FromEntity).ToList();
        }
    }
}
