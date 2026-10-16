using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Integrations
{
    public record GetIntegrationQuery(int Id) : IRequest<Result<IntegrationDto>>;

    public class GetIntegrationHandler : IRequestHandler<GetIntegrationQuery, Result<IntegrationDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetIntegrationHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<IntegrationDto>> Handle(GetIntegrationQuery request, CancellationToken cancellationToken)
        {
            var integration = await _context.Integrations
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            return integration is null
                ? Result<IntegrationDto>.NotFoundResult()
                : Result<IntegrationDto>.SuccessResult(IntegrationDto.FromEntity(integration));
        }
    }

    public record GetIntegrationsQuery(int? PropertyId, string? Category, string? Status) : IRequest<List<IntegrationDto>>;

    public class GetIntegrationsHandler : IRequestHandler<GetIntegrationsQuery, List<IntegrationDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetIntegrationsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<IntegrationDto>> Handle(GetIntegrationsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Integrations.AsNoTracking().AsQueryable();

            if (request.PropertyId.HasValue)
                query = query.Where(e => e.PropertyId == request.PropertyId.Value);
            if (!string.IsNullOrWhiteSpace(request.Category))
            {
                var category = request.Category.Trim().ToLower();
                query = query.Where(e => e.Category.ToLower() == category);
            }
            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                var status = request.Status.Trim().ToLower();
                query = query.Where(e => e.Status == status);
            }

            var integrations = await query.OrderBy(e => e.Name).ToListAsync(cancellationToken);
            return integrations.Select(IntegrationDto.FromEntity).ToList();
        }
    }
}
