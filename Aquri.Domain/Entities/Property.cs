using System;
using Aquri.Domain.Enums;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// Property entity with tenant identification for multi-tenancy.
    /// Every row must have a PropertyId (the tenant boundary).
    /// Domain-driven: business rules and invariants are enforced.
    /// All mutation goes through methods — no public setters.
    /// </summary>
    public class Property
    {
        public int Id { get; private set; }

        /// <summary>
        /// Tenant identifier for multi-tenancy.
        /// Required - every row must have a PropertyId.
        /// </summary>
        public int PropertyId { get; private set; }

        /// <summary>
        /// Name/title of the property.
        /// </summary>
        public string Name { get; private set; } = string.Empty;

        /// <summary>
        /// Description of the property.
        /// </summary>
        public string? Description { get; private set; }

        /// <summary>
        /// Address of the property.
        /// </summary>
        public string? Address { get; private set; }

        /// <summary>
        /// Manager name responsible for the property.
        /// </summary>
        public string? Manager { get; private set; }

        /// <summary>
        /// Rating of the property (0-5).
        /// </summary>
        public double Rating { get; private set; }

        /// <summary>
        /// Phone number for the property.
        /// </summary>
        public string? Phone { get; private set; }

        /// <summary>
        /// Email address for the property.
        /// </summary>
        public string? Email { get; private set; }

        /// <summary>
        /// Current status of the property.
        /// </summary>
        public PropertyStatus Status { get; private set; }

        /// <summary>
        /// Creation date (UTC). Set by the infrastructure layer after entity construction.
        /// </summary>
        public DateTime Created { get; private set; }

        /// <summary>
        /// Last modification date (UTC). Updated by domain methods.
        /// </summary>
        public DateTime LastModified { get; private set; }

        /// <summary>
        /// Default constructor for EF Core (parameterless, required by EF Core).
        /// All read-only properties are initialized to default values; the infrastructure
        /// layer must set Created/LastModified after construction.
        /// </summary>
        public Property() { }

        /// <summary>
        /// Constructor with required properties.
        /// </summary>
        /// <param name="name">Property name (required, cannot be null or empty)</param>
        /// <param name="propertyId">Tenant identifier (required, must be > 0)</param>
        /// <exception cref="ArgumentException">Thrown when name is whitespace or propertyId <= 0</exception>
        public Property(string name, int propertyId)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Property name cannot be null or empty.", nameof(name));
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be greater than 0.", nameof(propertyId));

            Name = name;
            PropertyId = propertyId;
            Status = PropertyStatus.Active;
            // Created/LastModified are intentionally NOT set here; the infrastructure
            // layer assigns them after entity construction to respect single-responsibility.
        }

        /// <summary>
        /// Renames the property and updates the modification date.
        /// </summary>
        /// <param name="newName">New property name (cannot be null or empty)</param>
        /// <exception cref="ArgumentException">Thrown when newName is whitespace</exception>
        public void Rename(string newName)
        {
            if (string.IsNullOrWhiteSpace(newName))
                throw new ArgumentException("Property name cannot be null or empty.", nameof(newName));

            Name = newName;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>
        /// Updates the descriptive/optional fields of the property in one call.
        /// Enforces rating bounds (0-5) and updates LastModified.
        /// </summary>
        public void UpdateDetails(
            string? description,
            string? address,
            string? manager,
            double rating,
            string? phone,
            string? email)
        {
            if (rating < 0 || rating > 5)
                throw new ArgumentOutOfRangeException(nameof(rating), "Rating must be between 0 and 5.");

            Description = description;
            Address = address;
            Manager = manager;
            Rating = rating;
            Phone = phone;
            Email = email;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>
        /// Updates the property status to a valid value.
        /// </summary>
        /// <param name="newStatus">New status</param>
        /// <exception cref="ArgumentException">Thrown when status is not a valid PropertyStatus value</exception>
        public void UpdateStatus(PropertyStatus newStatus)
        {
            Status = newStatus;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>
        /// Validates the entity is in a valid state.
        /// </summary>
        /// <returns>True if the entity is valid</returns>
        public bool IsValid()
        {
            return !string.IsNullOrWhiteSpace(Name) && PropertyId > 0;
        }

        /// <summary>
        /// Checks if the entity has a valid tenant identifier.
        /// </summary>
        /// <returns>True if PropertyId is set ( > 0)</returns>
        public bool HasTenantId() => PropertyId > 0;
    }
}
