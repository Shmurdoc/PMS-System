using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.AiWorkflows
{
    /// <summary>Deletes a workflow.</summary>
    public record DeleteWorkflowCommand(int Id) : IRequest<Result>;

    public class DeleteWorkflowHandler : IRequestHandler<DeleteWorkflowCommand, Result>
    {
        private readonly IApplicationDbContext _context;

        public DeleteWorkflowHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result> Handle(DeleteWorkflowCommand request, CancellationToken cancellationToken)
        {
            var workflow = await _context.Workflows
                .FirstOrDefaultAsync(w => w.Id == request.Id, cancellationToken);

            if (workflow is null)
                return Result.NotFoundResult();

            _context.Workflows.Remove(workflow);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
