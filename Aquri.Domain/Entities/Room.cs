using System;
using Aquri.Domain.Enums;

namespace Aquri.Domain.Entities
{
    /// <summary>Room entity with tenant identification for multi-tenancy. Every room belongs to a Property (the tenant boundary). Domain-driven: business rules and invariants are enforced.</summary>
    public class Room
    {
        public int Id { get; private set; }

        /// <summary>Tenant identifier - links to the Property responsible for this room. Required - every room must have a PropertyId.</summary>
        public int PropertyId { get; private set; }

        /// <summary>Room number (unique within a property).</summary>
        public string Number { get; private set; } = string.Empty;

        /// <summary>Room type (single, double, suite, apartment, etc.).</summary>
        public string Type { get; private set; } = string.Empty;

        /// <summary>Bed type (twin, double, queen, king, sofabed, etc.).</summary>
        public string? BedType { get; private set; }

        /// <summary>Room view (city, ocean, mountain, garden, None).</summary>
        public string? View { get; private set; }

        /// <summary>Current status of the room.</summary>
        public RoomStatus Status { get; private set; } = RoomStatus.Available;

        /// <summary>Current nightly price in local currency.</summary>
        public decimal Price { get; private set; }

        /// <summary>Maximum number of guests allowed in the room.</summary>
        public int MaxOccupancy { get; private set; }

        /// <summary>Room size in square meters.</summary>
        public int? Size { get; private set; }

        /// <summary>Floor number where the room is located.</summary>
        public int Floor { get; private set; }

        /// <summary>Description of the room and its features.</summary>
        public string? Description { get; private set; }

        /// <summary>Image URL for the room gallery.</summary>
        public string? Image { get; private set; }

        /// <summary>List of amenities included in the room (e.g., wifi, minibar, balcony).</summary>
        public string[] Amenities { get; private set; } = Array.Empty<string>();

        /// <summary>Date and time when the room was last cleaned (ISO 8601 format).</summary>
        public DateTime? LastCleaned { get; private set; }

        /// <summary>Date and time when the room was last inspected (ISO 8601 format).</summary>
        public DateTime? LastInspected { get; private set; }

        /// <summary>Default constructor for EF Core (parameterless, required by EF Core). All read-only properties are initialized to default values; the infrastructure layer must set values after construction.</summary>
        public Room() { }

        /// <summary>Constructor with required properties.</summary>
        /// <param name="number">Room number (required, cannot be null or empty)</param>
        /// <param name="propertyId">Tenant identifier (required, must be > 0)</param>
        /// <param name="type">Room type (required)</param>
        /// <exception cref="ArgumentException">Thrown when number is whitespace, type is empty, or propertyId <= 0</exception>
        public Room(string number, int propertyId, string type)
        {
            if (string.IsNullOrWhiteSpace(number))
                throw new ArgumentException("Room number cannot be null or empty.", nameof(number));
            if (string.IsNullOrWhiteSpace(type))
                throw new ArgumentException("Room type cannot be null or empty.", nameof(type));
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be greater than 0.", nameof(propertyId));

            Number = number;
            PropertyId = propertyId;
            Type = type;
            Status = RoomStatus.Available;
        }

        /// <summary>Changes the room status.</summary>
        /// <param name="newStatus">New status</param>
        public void ChangeStatus(RoomStatus newStatus)
        {
            Status = newStatus;
        }

        /// <param name="newPrice">New price (must be >= 0)</param>
        /// <exception cref="ArgumentException">Thrown when price is negative</exception>
        public void UpdatePrice(decimal newPrice)
        {
            if (newPrice < 0)
                throw new ArgumentException("Room price cannot be negative.", nameof(newPrice));

            Price = newPrice;
        }

        /// <param name="maxOccupancy">New max occupancy (must be >= 1)</param>
        /// <exception cref="ArgumentException">Thrown when maxOccupancy < 1</exception>
        public void UpdateMaxOccupancy(int maxOccupancy)
        {
            if (maxOccupancy < 1)
                throw new ArgumentException("Max occupancy must be at least 1.", nameof(maxOccupancy));

            MaxOccupancy = maxOccupancy;
        }

        /// <param name="size">New size in square meters (must be >= 0)</param>
        /// <exception cref="ArgumentException">Thrown when size is negative</exception>
        public void UpdateSize(int size)
        {
            if (size < 0)
                throw new ArgumentException("Room size cannot be negative.", nameof(size));

            Size = size;
        }

        /// <param name="floor">New floor number (must be >= 0)</param>
        /// <exception cref="ArgumentException">Thrown when floor < 0</exception>
        public void UpdateFloor(int floor)
        {
            if (floor < 0)
                throw new ArgumentException("Floor cannot be negative.", nameof(floor));

            Floor = floor;
        }

        /// <summary>Sets the bed type for the room.</summary>
        /// <param name="bedType">Bed type (twin, double, queen, king, sofabed, etc.)</param>
        /// <exception cref="ArgumentException">Thrown when bedType is null or empty</exception>
        public void SetBedType(string bedType)
        {
            if (string.IsNullOrWhiteSpace(bedType))
                throw new ArgumentException("Bed type cannot be null or empty.", nameof(bedType));

            BedType = bedType;
        }

        /// <summary>Sets the room view.</summary>
        /// <param name="view">View type (city, ocean, mountain, garden, None)</param>
        /// <exception cref="ArgumentException">Thrown when view is null or empty</exception>
        public void SetView(string view)
        {
            if (string.IsNullOrWhiteSpace(view))
                throw new ArgumentException("View cannot be null or empty.", nameof(view));

            View = view;
        }

        /// <param name="amenity">Amenity name (cannot be null or empty)</param>
        /// <exception cref="ArgumentException">Thrown when amenity is null or empty</exception>
        public void AddAmenity(string amenity)
        {
            if (string.IsNullOrWhiteSpace(amenity))
                throw new ArgumentException("Amenity cannot be null or empty.", nameof(amenity));

            var current = Amenities;
            var updated = current.Append(amenity).ToArray();
            Amenities = updated;
        }

        /// <param name="amenity">Amenity name to remove</param>
        /// <exception cref="ArgumentException">Thrown when amenity not found</exception>
        public void RemoveAmenity(string amenity)
        {
            if (string.IsNullOrWhiteSpace(amenity))
                throw new ArgumentException("Amenity cannot be null or empty.", nameof(amenity));

            var current = Amenities;
            var removed = current.Where(a => a != amenity).ToArray();
            Amenities = removed;
        }

        /// <summary>Sets the last cleaned date.</summary>
        /// <param name="lastCleaned">ISO 8601 date string</param>
        public void SetLastCleaned(DateTime lastCleaned)
        {
            LastCleaned = lastCleaned;
        }

        /// <summary>Sets the last inspected date.</summary>
        /// <param name="lastInspected">ISO 8601 date string</param>
        public void SetLastInspected(DateTime lastInspected)
        {
            LastInspected = lastInspected;
        }

        /// <summary>Sets the description for the room.</summary>
        /// <param name="description">Room description</param>
        public void SetDescription(string description)
        {
            Description = description;
        }

        /// <summary>Renames the room number.</summary>
        /// <param name="newNumber">New room number (required, cannot be null or empty)</param>
        /// <exception cref="ArgumentException">Thrown when newNumber is whitespace</exception>
        public void Rename(string newNumber)
        {
            if (string.IsNullOrWhiteSpace(newNumber))
                throw new ArgumentException("Room number cannot be null or empty.", nameof(newNumber));

            Number = newNumber;
        }

        /// <param name="amenities">Amenity names to add</param>
        public void AddAmenities(string[] amenities)
        {
            if (amenities == null) return;
            var current = Amenities;
            var updated = current.Concat(amenities).ToArray();
            Amenities = updated;
        }

        /// <summary>Validates the entity is in a valid state.</summary>
        /// <returns>True if the entity is valid</returns>
        public bool IsValid()
        {
            return !string.IsNullOrWhiteSpace(Number) && PropertyId > 0 && !string.IsNullOrWhiteSpace(Type);
        }

        /// <summary>Checks if the room has a valid tenant identifier.</summary>
        /// <returns>True if PropertyId is set (> 0)</returns>
        public bool HasTenantId() => PropertyId > 0;
    }
}
