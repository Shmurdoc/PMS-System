using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.AiWorkflows
{
    public record GetWorkflowsQuery : IRequest<List<WorkflowDto>>;

    public class GetWorkflowsHandler : IRequestHandler<GetWorkflowsQuery, List<WorkflowDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetWorkflowsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<WorkflowDto>> Handle(GetWorkflowsQuery request, CancellationToken cancellationToken)
        {
            var workflows = await _context.Workflows
                .AsNoTracking()
                .OrderByDescending(w => w.CreatedAt)
                .ToListAsync(cancellationToken);

            return workflows.Select(WorkflowDto.FromEntity).ToList();
        }
    }
}
