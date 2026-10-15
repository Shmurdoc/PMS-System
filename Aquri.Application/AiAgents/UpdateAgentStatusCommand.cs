using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.AiAgents
{
    /// <summary>Pauses, resumes, or stops an agent.</summary>
    public record UpdateAgentStatusCommand(int Id, string Status) : IRequest<Result<AgentDto>>;

    public class UpdateAgentStatusHandler : IRequestHandler<UpdateAgentStatusCommand, Result<AgentDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateAgentStatusHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<AgentDto>> Handle(UpdateAgentStatusCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Status) || !Agent.ValidStatuses.Contains(request.Status))
                return Result<AgentDto>.Failure($"Status must be one of: {string.Join(", ", Agent.ValidStatuses)}.");

            var agent = await _context.Agents
                .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

            if (agent is null)
                return Result<AgentDto>.NotFoundResult();

            agent.SetStatus(request.Status);
            await _context.SaveChangesAsync(cancellationToken);

            var logs = await _context.AgentLogs.AsNoTracking()
                .Where(l => l.AgentId == agent.Id)
                .OrderByDescending(l => l.Time)
                .ThenByDescending(l => l.Id)
                .Take(20)
                .ToListAsync(cancellationToken);

            return Result<AgentDto>.SuccessResult(AgentDto.FromEntity(agent, logs));
        }
    }
}
