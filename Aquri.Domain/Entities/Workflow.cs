using System;

namespace Aquri.Domain.Entities
{
    /// <summary>A rules-based automation from the AI tab: something happens (Trigger), these steps run (Actions). Actions is stored as serialized JSON and handed to clients as a string array.</summary>
    public class Workflow
    {
        public static readonly string[] ValidStatuses = { "active", "inactive" };

        public int Id { get; private set; }
        public int? PropertyId { get; private set; }
        public string Name { get; private set; } = string.Empty;
        public string? Description { get; private set; }
        public string Trigger { get; private set; } = string.Empty;
        public string Actions { get; private set; } = "[]";
        public string Status { get; private set; } = "active";
        public DateTime? LastRun { get; private set; }
        public string? CreatedBy { get; private set; }
        public DateTime CreatedAt { get; private set; }

        public Workflow() { }

        public Workflow(int? propertyId, string name, string? description, string trigger, string actions, string status, string? createdBy)
        {
            if (propertyId is <= 0)
                throw new ArgumentException("PropertyId must be positive when specified.", nameof(propertyId));
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name cannot be empty.", nameof(name));
            if (string.IsNullOrWhiteSpace(trigger))
                throw new ArgumentException("Trigger cannot be empty.", nameof(trigger));
            if (string.IsNullOrWhiteSpace(actions))
                throw new ArgumentException("Actions cannot be empty.", nameof(actions));
            ValidateStatus(status);

            PropertyId = propertyId;
            Name = name.Trim();
            Description = description?.Trim();
            Trigger = trigger.Trim();
            Actions = actions;
            Status = status;
            CreatedBy = createdBy?.Trim();
            CreatedAt = DateTime.UtcNow;
        }

        /// <summary>Applies the fields an update may touch — callers pass the current value for anything the request left out.</summary>
        public void Update(string name, string? description, string trigger, string actions, string status)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name cannot be empty.", nameof(name));
            if (string.IsNullOrWhiteSpace(trigger))
                throw new ArgumentException("Trigger cannot be empty.", nameof(trigger));
            if (string.IsNullOrWhiteSpace(actions))
                throw new ArgumentException("Actions cannot be empty.", nameof(actions));
            ValidateStatus(status);

            Name = name.Trim();
            Description = description?.Trim();
            Trigger = trigger.Trim();
            Actions = actions;
            Status = status;
        }

        private static void ValidateStatus(string status)
        {
            if (!ValidStatuses.Contains(status))
                throw new ArgumentException($"Status must be one of: {string.Join(", ", ValidStatuses)}.", nameof(status));
        }
    }
}
