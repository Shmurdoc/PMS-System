using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.AiInsights
{
    /// <summary>Lists AI insights, optionally filtered by property.</summary>
    public record GetAiInsightsQuery(int? PropertyId) : IRequest<List<AiInsightDto>>;

    public class GetAiInsightsHandler : IRequestHandler<GetAiInsightsQuery, List<AiInsightDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetAiInsightsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<AiInsightDto>> Handle(GetAiInsightsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.AiInsights.AsNoTracking().AsQueryable();

            if (request.PropertyId.HasValue)
                query = query.Where(i => i.PropertyId == request.PropertyId.Value);

            var insights = await query
                .OrderByDescending(i => i.CreatedAt)
                .ToListAsync(cancellationToken);

            return insights.Select(AiInsightDto.FromEntity).ToList();
        }
    }
}
