using System;
using System.Text.Json;
using Aquri.Domain.Entities;

namespace Aquri.Application.AiWorkflows
{
    /// <summary>Workflow as returned by the API — Actions as a string array, never raw JSON.</summary>
    public class WorkflowDto
    {
        public int Id { get; init; }
        public int? PropertyId { get; init; }
        public string Name { get; init; } = string.Empty;
        public string? Description { get; init; }
        public string Trigger { get; init; } = string.Empty;
        public string[] Actions { get; init; } = Array.Empty<string>();
        public string Status { get; init; } = "active";
        public DateTime? LastRun { get; init; }
        public string? CreatedBy { get; init; }
        public DateTime CreatedAt { get; init; }

        public static WorkflowDto FromEntity(Workflow workflow) => new()
        {
            Id = workflow.Id,
            PropertyId = workflow.PropertyId,
            Name = workflow.Name,
            Description = workflow.Description,
            Trigger = workflow.Trigger,
            Actions = ParseActions(workflow.Actions),
            Status = workflow.Status,
            LastRun = workflow.LastRun,
            CreatedBy = workflow.CreatedBy,
            CreatedAt = workflow.CreatedAt
        };

        private static string[] ParseActions(string actions) =>
            JsonSerializer.Deserialize<string[]>(actions) ?? Array.Empty<string>();
    }
}
