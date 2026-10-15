using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.MaintenanceRequests
{
    /// <summary>Maintenance request as returned by the API.</summary>
    public class MaintenanceRequestDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public string Description { get; init; } = string.Empty;
        public string Status { get; init; } = "pending";
        public string Priority { get; init; } = "medium";
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static MaintenanceRequestDto FromEntity(MaintenanceRequest request) => new()
        {
            Id = request.Id,
            PropertyId = request.PropertyId,
            Description = request.Description,
            Status = request.Status,
            Priority = request.Priority,
            Created = request.Created,
            LastModified = request.LastModified
        };
    }
}
