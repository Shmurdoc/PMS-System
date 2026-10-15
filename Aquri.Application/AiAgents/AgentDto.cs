using System;
using System.Collections.Generic;
using System.Linq;
using Aquri.Domain.Entities;

namespace Aquri.Application.AiAgents
{
    /// <summary>One run-history entry as returned by the API.</summary>
    public class AgentLogDto
    {
        public DateTime Time { get; init; }
        public string Message { get; init; } = string.Empty;

        public static AgentLogDto FromEntity(AgentLog log) => new() { Time = log.Time, Message = log.Message };
    }

    /// <summary>Agent status card — key drives the frontend icon, logs arrive inline (latest 20).</summary>
    public class AgentDto
    {
        public int Id { get; init; }
        public string Key { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public string Status { get; init; } = string.Empty;
        public DateTime? LastRun { get; init; }
        public int TotalRuns { get; init; }
        public IReadOnlyList<AgentLogDto> Logs { get; init; } = Array.Empty<AgentLogDto>();

        public static AgentDto FromEntity(Agent agent, IEnumerable<AgentLog> logs) => new()
        {
            Id = agent.Id,
            Key = agent.Key,
            Name = agent.Name,
            Description = agent.Description,
            Status = agent.Status,
            LastRun = agent.LastRun,
            TotalRuns = agent.TotalRuns,
            Logs = logs.Select(AgentLogDto.FromEntity).ToList()
        };
    }
}
