using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.AiAgents
{
    /// <summary>Lists every agent with its 20 most recent log entries.</summary>
    public record GetAgentsQuery : IRequest<List<AgentDto>>;

    public class GetAgentsHandler : IRequestHandler<GetAgentsQuery, List<AgentDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetAgentsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<AgentDto>> Handle(GetAgentsQuery request, CancellationToken cancellationToken)
        {
            var agents = await _context.Agents.AsNoTracking()
                .OrderBy(a => a.Id)
                .ToListAsync(cancellationToken);

            var agentIds = agents.Select(a => a.Id).ToList();
            var logs = await _context.AgentLogs.AsNoTracking()
                .Where(l => agentIds.Contains(l.AgentId))
                .OrderByDescending(l => l.Time)
                .ThenByDescending(l => l.Id)
                .ToListAsync(cancellationToken);

            return agents
                .Select(a => AgentDto.FromEntity(
                    a,
                    logs.Where(l => l.AgentId == a.Id).Take(20)))
                .ToList();
        }
    }
}
