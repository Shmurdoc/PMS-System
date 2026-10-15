using System.Text.Json;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.AiWorkflows
{
    /// <summary>Creates a workflow — status defaults to active.</summary>
    public record CreateWorkflowCommand(
        int? PropertyId,
        string Name,
        string? Description,
        string Trigger,
        string[] Actions,
        string? Status,
        string? CreatedBy) : IRequest<Result<WorkflowDto>>;

    public class CreateWorkflowHandler : IRequestHandler<CreateWorkflowCommand, Result<WorkflowDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateWorkflowHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<WorkflowDto>> Handle(CreateWorkflowCommand request, CancellationToken cancellationToken)
        {
            if (request.PropertyId is <= 0)
                return Result<WorkflowDto>.Failure("PropertyId must be positive when specified.");
            if (string.IsNullOrWhiteSpace(request.Name))
                return Result<WorkflowDto>.Failure("Name cannot be empty.");
            if (string.IsNullOrWhiteSpace(request.Trigger))
                return Result<WorkflowDto>.Failure("Trigger cannot be empty.");
            if (request.Actions is null || request.Actions.Length == 0 || request.Actions.Any(string.IsNullOrWhiteSpace))
                return Result<WorkflowDto>.Failure("Actions cannot be empty.");

            var status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status;
            if (!Workflow.ValidStatuses.Contains(status))
                return Result<WorkflowDto>.Failure(
                    $"Status must be one of: {string.Join(", ", Workflow.ValidStatuses)}.");

            var workflow = new Workflow(
                request.PropertyId, request.Name, request.Description, request.Trigger,
                JsonSerializer.Serialize(request.Actions), status, request.CreatedBy);

            _context.Workflows.Add(workflow);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<WorkflowDto>.SuccessResult(WorkflowDto.FromEntity(workflow));
        }
    }
}
