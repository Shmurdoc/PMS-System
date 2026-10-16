using System;
using System.Linq;

namespace Aquri.Domain.Entities
{
    /// <summary>One of the six workers behind the AI tab. Key is the stable slug the frontend maps to an icon; Status gates whether a run is allowed.</summary>
    public class Agent
    {
        public static readonly string[] ValidStatuses = { "running", "paused", "stopped" };

        public int Id { get; private set; }
        public string Key { get; private set; } = string.Empty;
        public string Name { get; private set; } = string.Empty;
        public string Description { get; private set; } = string.Empty;
        public string Status { get; private set; } = "running";
        public DateTime? LastRun { get; private set; }
        public int TotalRuns { get; private set; }

        public Agent() { }

        public Agent(string key, string name, string description, string status = "running")
        {
            if (string.IsNullOrWhiteSpace(key))
                throw new ArgumentException("Key cannot be empty.", nameof(key));
            if (key.Any(char.IsUpper) || key.Any(char.IsWhiteSpace))
                throw new ArgumentException("Key must be a lowercase slug without spaces.", nameof(key));
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name cannot be empty.", nameof(name));
            ValidateStatus(status);

            Key = key.Trim();
            Name = name.Trim();
            Description = description?.Trim() ?? string.Empty;
            Status = status;
        }

        public void SetStatus(string status)
        {
            ValidateStatus(status);
            Status = status;
        }

        /// <summary>Marks a completed run — bumps the counter and stamps the time.</summary>
        public void RecordRun()
        {
            TotalRuns++;
            LastRun = DateTime.UtcNow;
        }

        private static void ValidateStatus(string status)
        {
            if (!ValidStatuses.Contains(status))
                throw new ArgumentException($"Status must be one of: {string.Join(", ", ValidStatuses)}.", nameof(status));
        }
    }
}
