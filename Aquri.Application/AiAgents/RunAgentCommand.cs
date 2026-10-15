using Aquri.Application.AiInsights;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.AiAgents
{
    /// <summary>Result of a manual run — the refreshed agent card plus the insight it produced.</summary>
    public record RunAgentResultDto(AgentDto Agent, AiInsightDto Insight);

    /// <summary>Executes an agent against live data: new insight, new log entry, bumped counters.</summary>
    public record RunAgentCommand(int Id) : IRequest<Result<RunAgentResultDto>>;

    public class RunAgentHandler : IRequestHandler<RunAgentCommand, Result<RunAgentResultDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly AgentInsightGenerator _generator;

        public RunAgentHandler(IApplicationDbContext context, AgentInsightGenerator generator)
        {
            _context = context;
            _generator = generator;
        }

        public async Task<Result<RunAgentResultDto>> Handle(RunAgentCommand request, CancellationToken cancellationToken)
        {
            var agent = await _context.Agents
                .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

            if (agent is null)
                return Result<RunAgentResultDto>.NotFoundResult();

            if (agent.Status == "stopped")
                return Result<RunAgentResultDto>.Failure("Stopped agents cannot be run — set the agent to running or paused first.");

            var generated = await _generator.GenerateAsync(agent.Key, cancellationToken);
            if (generated is null)
                return Result<RunAgentResultDto>.Failure($"Agent '{agent.Key}' has no run generator.");

            var insight = new AiInsight(
                null, generated.Type, generated.Title, generated.Description, generated.Recommendation, generated.Impact);

            _context.AiInsights.Add(insight);
            _context.AgentLogs.Add(new AgentLog(agent.Id, generated.LogMessage));
            agent.RecordRun();
            await _context.SaveChangesAsync(cancellationToken);

            var logs = await _context.AgentLogs.AsNoTracking()
                .Where(l => l.AgentId == agent.Id)
                .OrderByDescending(l => l.Time)
                .ThenByDescending(l => l.Id)
                .Take(20)
                .ToListAsync(cancellationToken);

            return Result<RunAgentResultDto>.SuccessResult(
                new RunAgentResultDto(AgentDto.FromEntity(agent, logs), AiInsightDto.FromEntity(insight)));
        }
    }
}
