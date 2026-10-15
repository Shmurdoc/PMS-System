using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.AiInsights
{
    /// <summary>Sparse update — any subset of fields; null dismissed keeps the current tri-state.</summary>
    public record UpdateAiInsightCommand(
        int Id,
        string? Type,
        string? Title,
        string? Description,
        string? Recommendation,
        string? Impact,
        bool? Dismissed) : IRequest<Result<AiInsightDto>>;

    public class UpdateAiInsightHandler : IRequestHandler<UpdateAiInsightCommand, Result<AiInsightDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateAiInsightHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<AiInsightDto>> Handle(UpdateAiInsightCommand request, CancellationToken cancellationToken)
        {
            var insight = await _context.AiInsights
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (insight is null)
                return Result<AiInsightDto>.NotFoundResult();

            var type = request.Type ?? insight.Type;
            var title = request.Title ?? insight.Title;
            var description = request.Description ?? insight.Description;
            var recommendation = request.Recommendation ?? insight.Recommendation;
            var impact = request.Impact ?? insight.Impact;

            if (!AiInsight.ValidTypes.Contains(type))
                return Result<AiInsightDto>.Failure(
                    $"Type must be one of: {string.Join(", ", AiInsight.ValidTypes)}.");
            if (string.IsNullOrWhiteSpace(title))
                return Result<AiInsightDto>.Failure("Title cannot be empty.");
            if (!AiInsight.ValidImpacts.Contains(impact))
                return Result<AiInsightDto>.Failure(
                    $"Impact must be one of: {string.Join(", ", AiInsight.ValidImpacts)}.");

            insight.Update(type, title, description, recommendation, impact);
            if (request.Dismissed.HasValue)
                insight.SetDismissed(request.Dismissed.Value);

            await _context.SaveChangesAsync(cancellationToken);
            return Result<AiInsightDto>.SuccessResult(AiInsightDto.FromEntity(insight));
        }
    }
}
