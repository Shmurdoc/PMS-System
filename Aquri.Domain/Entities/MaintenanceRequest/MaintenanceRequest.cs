using System;
using System.ComponentModel.DataAnnotations;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// Maintenance request entity for property maintenance tracking.
    /// Associated with a Property (tenant) for multi-tenancy.
    /// </summary>
    public class MaintenanceRequest
    {
        public int Id { get; set; }

        /// <summary>
        /// Description of the maintenance needed.
        /// </summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Tenant identifier - links to the Property responsible for this maintenance.
        /// </summary>
        public int PropertyId { get; set; }

        /// <summary>
        /// Status of the maintenance request (pending, in-progress, completed).
        /// </summary>
        public string Status { get; set; } = "pending";

        /// <summary>
        /// Priority of the maintenance request (low, medium, high).
        /// </summary>
        public string Priority { get; set; } = "medium";

        /// <summary>
        /// Date when the request was created (UTC).
        /// </summary>
        public DateTime Created { get; set; }

        /// <summary>
        /// Date when the request was last updated (UTC).
        /// </summary>
        public DateTime LastModified { get; set; }

        /// <summary>
        /// Default constructor for EF Core.
        /// </summary>
        public MaintenanceRequest() { }

        /// <summary>
        /// Constructor with required properties.
        /// </summary>
        /// <param name="description">Description of the maintenance needed</param>
        /// <param name="propertyId">Tenant identifier</param>
        public MaintenanceRequest(string description, int propertyId)
        {
            Description = description;
            PropertyId = propertyId;
            Status = "pending";
            Priority = "medium";
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>
        /// Updates the status and priority of the maintenance request.
        /// </summary>
        /// <param name="newStatus">New status</param>
        /// <param name="newPriority">New priority</param>
        public void UpdateStatus(string newStatus, string newPriority)
        {
            Status = newStatus;
            Priority = newPriority;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>
        /// Validates the maintenance request is in a valid state.
        /// </summary>
        /// <returns>True if the request is valid</returns>
        public bool IsValid()
        {
            return !string.IsNullOrWhiteSpace(Description) && PropertyId > 0;
        }

        /// <summary>
        /// Checks if the request has a valid tenant identifier.
        /// </summary>
        /// <returns>True if PropertyId is set</returns>
        public bool HasTenantId() => PropertyId > 0;
    }
}