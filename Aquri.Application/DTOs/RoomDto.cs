namespace Aquri.Application.DTOs
{
    /// <summary>
    /// Data Transfer Object for Property entities.
    /// Used for API requests and responses to separate from domain entities.
    /// </summary>
    public class PropertyDto
    {
        /// <summary>
        /// Unique identifier for the property.
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Tenant identifier for multi-tenancy (the property boundary).
        /// </summary>
        public int PropertyId { get; set; }

        /// <summary>
        /// Name/title of the property.
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Description of the property.
        /// </summary>
        public string? Description { get; set; }

        /// <summary>
        /// Current status of the property.
        /// </summary>
        public string Status { get; set; } = "Active";

        /// <summary>
        /// Address of the property.
        /// </summary>
        public string? Address { get; set; }

        /// <summary>
        /// Manager name responsible for the property.
        /// </summary>
        public string? Manager { get; set; }

        /// <summary>
        /// Rating of the property (0-5).
        /// </summary>
        public double Rating { get; set; }

        /// <summary>
        /// Phone number for the property.
        /// </summary>
        public string? Phone { get; set; }

        /// <summary>
        /// Email address for the property.
        /// </summary>
        public string? Email { get; set; }

        /// <summary>
        /// Date when the property was created (UTC).
        /// </summary>
        public DateTime Created { get; set; }

        /// <summary>
        /// Date when the property was last modified (UTC).
        /// </summary>
        public DateTime LastModified { get; set; }
    }

    /// <summary>
    /// Data Transfer Object for Room entities.
    /// Used for API requests and responses to separate from domain entities.
    /// </summary>
    public class RoomDto
    {
        /// <summary>
        /// Unique identifier for the room.
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Room number (unique within a property).
        /// </summary>
        public string Number { get; set; } = string.Empty;

        /// <summary>
        /// Tenant identifier - links to the Property.
        /// </summary>
        public int PropertyId { get; set; }

        /// <summary>
        /// Room type (single, double, suite, apartment, etc.).
        /// </summary>
        public string Type { get; set; } = string.Empty;

        /// <summary>
        /// Bed type (twin, double, queen, king, sofabed, etc.).
        /// </summary>
        public string? BedType { get; set; }

        /// <summary>
        /// View type (city, ocean, mountain, garden, None).
        /// </summary>
        public string? View { get; set; }

        /// <summary>
        /// Current status of the room.
        /// </summary>
        public string Status { get; set; } = "available";

        /// <summary>
        /// Current nightly price in local currency.
        /// </summary>
        public decimal Price { get; set; }

        /// <summary>
        /// Maximum number of guests allowed in the room.
        /// </summary>
        public int MaxOccupancy { get; set; }

        /// <summary>
        /// Room size in square meters.
        /// </summary>
        public int? Size { get; set; }

        /// <summary>
        /// Floor number where the room is located.
        /// </summary>
        public int Floor { get; set; }

        /// <summary>
        /// Description of the room and its features.
        /// </summary>
        public string? Description { get; set; }

        /// <summary>
        /// Image URL for the room gallery.
        /// </summary>
        public string? Image { get; set; }

        /// <summary>
        /// List of amenities included in the room.
        /// </summary>
        public string[] Amenities { get; set; } = Array.Empty<string>();

        /// <summary>
        /// Date and time when the room was last cleaned (ISO 8601 format).
        /// </summary>
        public DateTime? LastCleaned { get; set; }

        /// <summary>
        /// Date and time when the room was last inspected (ISO 8601 format).
        /// </summary>
        public DateTime? LastInspected { get; set; }

        /// <summary>
        /// Current occupant information.
        /// </summary>
        public OccupantDto? Occupant { get; set; }
    }

    /// <summary>
    /// Data Transfer Object for occupant information.
    /// </summary>
    public class OccupantDto
    {
        /// <summary>
        /// Guest name.
        /// </summary>
        public string GuestName { get; set; } = string.Empty;

        /// <summary>
        /// Check-in date (ISO 8601 format).
        /// </summary>
        public string CheckIn { get; set; } = string.Empty;

        /// <summary>
        /// Check-out date (ISO 8601 format).
        /// </summary>
        public string CheckOut { get; set; } = string.Empty;

        /// <summary>
        /// Number of nights stayed.
        /// </summary>
        public int Nights { get; set; }
    }

    /// <summary>
    /// DTO for creating a new room (used inside CreatePropertyWithRoomsCommand).
    /// </summary>
    public class CreateRoomDto
    {
        /// <summary>
        /// Room number (unique within a property).
        /// </summary>
        public string Number { get; set; } = string.Empty;

        /// <summary>
        /// Room type (single, double, suite, apartment, etc.).
        /// </summary>
        public string Type { get; set; } = string.Empty;

        /// <summary>
        /// Bed type (twin, double, queen, king, sofabed, etc.).
        /// </summary>
        public string? BedType { get; set; }

        /// <summary>
        /// View type (city, ocean, mountain, garden, None).
        /// </summary>
        public string? View { get; set; }

        /// <summary>
        /// Initial price.
        /// </summary>
        public decimal Price { get; set; }

        /// <summary>
        /// Maximum occupancy.
        /// </summary>
        public int MaxOccupancy { get; set; }

        /// <summary>
        /// Room size in square meters.
        /// </summary>
        public int? Size { get; set; }

        /// <summary>
        /// Floor number.
        /// </summary>
        public int Floor { get; set; }

        /// <summary>
        /// Room description.
        /// </summary>
        public string? Description { get; set; }

        /// <summary>
        /// Initial amenities list.
        /// </summary>
        public string[]? Amenities { get; set; }
    }
}
