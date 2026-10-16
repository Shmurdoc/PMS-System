using System;

namespace Aquri.Domain.Entities
{
    /// <summary>A single entry in an agent's run history — what it did, when. Append-only; the API exposes the latest 20 per agent.</summary>
    public class AgentLog
    {
        public int Id { get; private set; }
        public int AgentId { get; private set; }
        public DateTime Time { get; private set; }
        public string Message { get; private set; } = string.Empty;

        public AgentLog() { }

        public AgentLog(int agentId, string message)
        {
            if (agentId <= 0)
                throw new ArgumentException("AgentId must be positive.", nameof(agentId));
            if (string.IsNullOrWhiteSpace(message))
                throw new ArgumentException("Message cannot be empty.", nameof(message));

            AgentId = agentId;
            Message = message.Trim();
            Time = DateTime.UtcNow;
        }
    }
}
