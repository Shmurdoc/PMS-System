using System.Text.Json;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.AiWorkflows
{
    /// <summary>Edits a workflow — absent fields keep their current value.</summary>
    public record UpdateWorkflowCommand(
        int Id,
        string? Name,
        string? Description,
        string? Trigger,
        string[]? Actions,
        string? Status) : IRequest<Result<WorkflowDto>>;

    public class UpdateWorkflowHandler : IRequestHandler<UpdateWorkflowCommand, Result<WorkflowDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateWorkflowHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<WorkflowDto>> Handle(UpdateWorkflowCommand request, CancellationToken cancellationToken)
        {
            var workflow = await _context.Workflows
                .FirstOrDefaultAsync(w => w.Id == request.Id, cancellationToken);

            if (workflow is null)
                return Result<WorkflowDto>.NotFoundResult();

            var name = request.Name ?? workflow.Name;
            var trigger = request.Trigger ?? workflow.Trigger;
            var status = request.Status ?? workflow.Status;
            var actions = request.Actions is null
                ? workflow.Actions
                : JsonSerializer.Serialize(request.Actions);

            if (string.IsNullOrWhiteSpace(name))
                return Result<WorkflowDto>.Failure("Name cannot be empty.");
            if (string.IsNullOrWhiteSpace(trigger))
                return Result<WorkflowDto>.Failure("Trigger cannot be empty.");
            if (request.Actions is not null && (request.Actions.Length == 0 || request.Actions.Any(string.IsNullOrWhiteSpace)))
                return Result<WorkflowDto>.Failure("Actions cannot be empty.");
            if (!Workflow.ValidStatuses.Contains(status))
                return Result<WorkflowDto>.Failure(
                    $"Status must be one of: {string.Join(", ", Workflow.ValidStatuses)}.");

            workflow.Update(name, request.Description ?? workflow.Description, trigger, actions, status);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<WorkflowDto>.SuccessResult(WorkflowDto.FromEntity(workflow));
        }
    }
}
