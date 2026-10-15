using Aquri.Domain.Entities;
using Aquri.Domain.Enums;

namespace Aquri.Application.RfidTags
{
    /// <summary>Issued RFID tag as returned by the API. Names ride along for list views.</summary>
    public class RfidTagDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }

        /// <summary>guest | staff.</summary>
        public string Kind { get; init; } = "guest";

        public string TagNumber { get; init; } = string.Empty;

        /// <summary>active | inactive | lost | blocked.</summary>
        public string Status { get; init; } = "active";

        public int? UserId { get; init; }
        public string? UserName { get; init; }
        public int? BookingId { get; init; }
        public string? GuestName { get; init; }
        public string? RoomNumber { get; init; }
        public string AccessLevel { get; init; } = string.Empty;
        public DateTime? ExpiresAt { get; init; }
        public DateTime? LastUsed { get; init; }
        public string? Notes { get; init; }
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static RfidTagDto FromEntity(
            RfidTag tag,
            string? userName = null,
            string? guestName = null,
            string? roomNumber = null) => new()
        {
            Id = tag.Id,
            PropertyId = tag.PropertyId,
            Kind = tag.Kind.ToWire(),
            TagNumber = tag.TagNumber,
            Status = tag.Status.ToWire(),
            UserId = tag.UserId,
            UserName = userName,
            BookingId = tag.BookingId,
            GuestName = guestName,
            RoomNumber = roomNumber,
            AccessLevel = tag.AccessLevel,
            ExpiresAt = tag.ExpiresAt,
            LastUsed = tag.LastUsed,
            Notes = tag.Notes,
            Created = tag.Created,
            LastModified = tag.LastModified
        };
    }
}
