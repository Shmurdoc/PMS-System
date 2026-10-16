using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.RatePlans
{
    public record GetRatePlanQuery(int Id) : IRequest<Result<RatePlanDto>>;

    public class GetRatePlanHandler : IRequestHandler<GetRatePlanQuery, Result<RatePlanDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetRatePlanHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<RatePlanDto>> Handle(GetRatePlanQuery request, CancellationToken cancellationToken)
        {
            var plan = await _context.RatePlans
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

            return plan is null
                ? Result<RatePlanDto>.NotFoundResult()
                : Result<RatePlanDto>.SuccessResult(RatePlanDto.FromEntity(plan));
        }
    }

    public record GetRatePlansQuery(int? PropertyId, bool? Active) : IRequest<List<RatePlanDto>>;

    public class GetRatePlansHandler : IRequestHandler<GetRatePlansQuery, List<RatePlanDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetRatePlansHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<RatePlanDto>> Handle(GetRatePlansQuery request, CancellationToken cancellationToken)
        {
            var query = _context.RatePlans.AsNoTracking().AsQueryable();

            if (request.PropertyId.HasValue)
                query = query.Where(p => p.PropertyId == request.PropertyId.Value);
            if (request.Active.HasValue)
                query = query.Where(p => p.Active == request.Active.Value);

            var plans = await query.OrderBy(p => p.Name).ToListAsync(cancellationToken);
            return plans.Select(RatePlanDto.FromEntity).ToList();
        }
    }
}
