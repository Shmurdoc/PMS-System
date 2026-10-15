using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.AiInsights
{
    /// <summary>Creates an AI insight — dismissed starts as null (not acted on).</summary>
    public record CreateAiInsightCommand(
        int? PropertyId,
        string Type,
        string Title,
        string? Description,
        string? Recommendation,
        string Impact) : IRequest<Result<AiInsightDto>>;

    public class CreateAiInsightHandler : IRequestHandler<CreateAiInsightCommand, Result<AiInsightDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateAiInsightHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<AiInsightDto>> Handle(CreateAiInsightCommand request, CancellationToken cancellationToken)
        {
            if (request.PropertyId is <= 0)
                return Result<AiInsightDto>.Failure("PropertyId must be positive when specified.");
            if (!AiInsight.ValidTypes.Contains(request.Type))
                return Result<AiInsightDto>.Failure(
                    $"Type must be one of: {string.Join(", ", AiInsight.ValidTypes)}.");
            if (string.IsNullOrWhiteSpace(request.Title))
                return Result<AiInsightDto>.Failure("Title cannot be empty.");
            if (!AiInsight.ValidImpacts.Contains(request.Impact))
                return Result<AiInsightDto>.Failure(
                    $"Impact must be one of: {string.Join(", ", AiInsight.ValidImpacts)}.");

            var insight = new AiInsight(
                request.PropertyId, request.Type, request.Title,
                request.Description, request.Recommendation, request.Impact);

            _context.AiInsights.Add(insight);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<AiInsightDto>.SuccessResult(AiInsightDto.FromEntity(insight));
        }
    }
}
