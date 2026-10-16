using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.Integrations
{
    /// <summary>
    /// A third-party integration as returned by the API. The API key is
    /// included so admins can view what they configured; it is never logged.
    /// </summary>
    public class IntegrationDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public string Name { get; init; } = string.Empty;
        public string Category { get; init; } = string.Empty;
        public string Status { get; init; } = "disconnected";
        public DateTime? LastSync { get; init; }
        public string? Icon { get; init; }
        public string Description { get; init; } = string.Empty;
        public string? ApiKey { get; init; }
        public string? WebhookUrl { get; init; }
        public string? ConfiguredBy { get; init; }
        public DateTime? ConfiguredAt { get; init; }
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static IntegrationDto FromEntity(Integration integration) => new()
        {
            Id = integration.Id,
            PropertyId = integration.PropertyId,
            Name = integration.Name,
            Category = integration.Category,
            Status = integration.Status,
            LastSync = integration.LastSync,
            Icon = integration.Icon,
            Description = integration.Description,
            ApiKey = integration.ApiKey,
            WebhookUrl = integration.WebhookUrl,
            ConfiguredBy = integration.ConfiguredBy,
            ConfiguredAt = integration.ConfiguredAt,
            Created = integration.Created,
            LastModified = integration.LastModified
        };
    }
}
