using System;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// A recommendation surfaced on the AI tab — revenue nudges, staffing
    /// warnings, maintenance flags. PropertyId null means it applies everywhere.
    /// Dismissal is three-state: null = not acted on, false = acknowledged,
    /// true = dismissed.
    /// </summary>
    public class AiInsight
    {
        public static readonly string[] ValidTypes =
            { "revenue", "occupancy", "staffing", "maintenance", "guest", "operational" };

        public static readonly string[] ValidImpacts = { "high", "medium", "low" };

        public int Id { get; private set; }
        public int? PropertyId { get; private set; }
        public string Type { get; private set; } = string.Empty;
        public string Title { get; private set; } = string.Empty;
        public string Description { get; private set; } = string.Empty;
        public string Recommendation { get; private set; } = string.Empty;
        public string Impact { get; private set; } = string.Empty;
        public bool? Dismissed { get; private set; }
        public DateTime CreatedAt { get; private set; }

        public AiInsight() { }

        public AiInsight(int? propertyId, string type, string title, string? description, string? recommendation, string impact)
        {
            if (propertyId is <= 0)
                throw new ArgumentException("PropertyId must be positive when specified.", nameof(propertyId));
            ValidateType(type);
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("Title cannot be empty.", nameof(title));
            ValidateImpact(impact);

            PropertyId = propertyId;
            Type = type.Trim();
            Title = title.Trim();
            Description = description?.Trim() ?? string.Empty;
            Recommendation = recommendation?.Trim() ?? string.Empty;
            Impact = impact.Trim();
            CreatedAt = DateTime.UtcNow;
        }

        /// <summary>Applies the fields an update may touch — callers pass the current value for anything the request left out.</summary>
        public void Update(string type, string title, string? description, string? recommendation, string impact)
        {
            ValidateType(type);
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("Title cannot be empty.", nameof(title));
            ValidateImpact(impact);

            Type = type.Trim();
            Title = title.Trim();
            Description = description?.Trim() ?? string.Empty;
            Recommendation = recommendation?.Trim() ?? string.Empty;
            Impact = impact.Trim();
        }

        public void SetDismissed(bool dismissed)
        {
            Dismissed = dismissed;
        }

        private static void ValidateType(string type)
        {
            if (!ValidTypes.Contains(type))
                throw new ArgumentException($"Type must be one of: {string.Join(", ", ValidTypes)}.", nameof(type));
        }

        private static void ValidateImpact(string impact)
        {
            if (!ValidImpacts.Contains(impact))
                throw new ArgumentException($"Impact must be one of: {string.Join(", ", ValidImpacts)}.", nameof(impact));
        }
    }
}
