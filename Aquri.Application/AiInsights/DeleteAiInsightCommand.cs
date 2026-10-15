using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.AiInsights
{
    /// <summary>Deletes an AI insight.</summary>
    public record DeleteAiInsightCommand(int Id) : IRequest<Result>;

    public class DeleteAiInsightHandler : IRequestHandler<DeleteAiInsightCommand, Result>
    {
        private readonly IApplicationDbContext _context;

        public DeleteAiInsightHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result> Handle(DeleteAiInsightCommand request, CancellationToken cancellationToken)
        {
            var insight = await _context.AiInsights
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (insight is null)
                return Result.NotFoundResult();

            _context.AiInsights.Remove(insight);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
