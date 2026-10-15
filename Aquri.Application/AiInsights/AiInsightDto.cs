using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.AiInsights
{
    /// <summary>AI insight as returned by the API.</summary>
    public class AiInsightDto
    {
        public int Id { get; init; }
        public int? PropertyId { get; init; }
        public string Type { get; init; } = string.Empty;
        public string Title { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public string Recommendation { get; init; } = string.Empty;
        public string Impact { get; init; } = string.Empty;
        public bool? Dismissed { get; init; }
        public DateTime CreatedAt { get; init; }

        public static AiInsightDto FromEntity(AiInsight insight) => new()
        {
            Id = insight.Id,
            PropertyId = insight.PropertyId,
            Type = insight.Type,
            Title = insight.Title,
            Description = insight.Description,
            Recommendation = insight.Recommendation,
            Impact = insight.Impact,
            Dismissed = insight.Dismissed,
            CreatedAt = insight.CreatedAt
        };
    }
}
