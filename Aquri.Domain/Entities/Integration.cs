using System;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// A third-party system wired into the property — payment gateway, channel
    /// manager, POS. The API key is a secret: surface it to admins through the
    /// DTO for configuration, never write it to logs.
    /// </summary>
    public class Integration
    {
        public static readonly string[] ValidStatuses = { "connected", "disconnected", "error", "syncing" };

        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public string Name { get; private set; } = string.Empty;
        public string Category { get; private set; } = string.Empty;
        public string Status { get; private set; } = "disconnected";
        public DateTime? LastSync { get; private set; }
        public string? Icon { get; private set; }
        public string Description { get; private set; } = string.Empty;
        public string? ApiKey { get; private set; }
        public string? WebhookUrl { get; private set; }
        public string? ConfiguredBy { get; private set; }
        public DateTime? ConfiguredAt { get; private set; }
        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public Integration() { }

        public Integration(int propertyId, string name, string category, string? description,
            string? icon, string? apiKey, string? webhookUrl, string? configuredBy)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name cannot be empty.", nameof(name));
            if (string.IsNullOrWhiteSpace(category))
                throw new ArgumentException("Category cannot be empty.", nameof(category));

            PropertyId = propertyId;
            Name = name.Trim();
            Category = category.Trim();
            Description = description?.Trim() ?? string.Empty;
            Icon = icon?.Trim();
            ApiKey = apiKey;
            WebhookUrl = webhookUrl?.Trim();
            ConfiguredBy = configuredBy?.Trim();
            ConfiguredAt = DateTime.UtcNow;
            Status = "disconnected";
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Edits the integration details; status changes go through <see cref="SetStatus"/>.</summary>
        public void Update(string? name, string? category, string? description, string? icon,
            string? apiKey, string? webhookUrl)
        {
            if (name is not null)
            {
                if (string.IsNullOrWhiteSpace(name))
                    throw new ArgumentException("Name cannot be empty.", nameof(name));
                Name = name.Trim();
            }
            if (category is not null)
            {
                if (string.IsNullOrWhiteSpace(category))
                    throw new ArgumentException("Category cannot be empty.", nameof(category));
                Category = category.Trim();
            }
            if (description is not null)
                Description = description.Trim();
            if (icon is not null)
                Icon = icon.Trim();
            if (apiKey is not null)
                ApiKey = apiKey;
            if (webhookUrl is not null)
                WebhookUrl = webhookUrl.Trim();
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Flips the integration to a known status (business rule — vocabulary lives here).</summary>
        public void SetStatus(string status)
        {
            if (!ValidStatuses.Contains(status))
                throw new ArgumentException($"Status must be one of: {string.Join(", ", ValidStatuses)}.", nameof(status));

            Status = status;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Records a successful sync — stamps the time and flips to connected.</summary>
        public void MarkSynced()
        {
            LastSync = DateTime.UtcNow;
            Status = "connected";
            LastModified = DateTime.UtcNow;
        }
    }
}
