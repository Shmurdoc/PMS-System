using System;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Entities
{
    /// <summary>An issued NFC/RFID tag. One entity covers both kinds: a guest tag is bound to a booking for the length of a stay, a staff badge is bound to a user. Exactly one binding is set, driven by <see cref="Kind"/>.</summary>
    public class RfidTag
    {
        public int Id { get; private set; }
        public int PropertyId { get; private set; }

        /// <summary>guest | staff — see <see cref="RfidTagKind"/>.</summary>
        public RfidTagKind Kind { get; private set; }

        /// <summary>Raw UID read from the card/tag. Unique per property.</summary>
        public string TagNumber { get; private set; } = string.Empty;

        /// <summary>active | inactive | lost | blocked — see <see cref="RfidTagStatus"/>.</summary>
        public RfidTagStatus Status { get; private set; } = RfidTagStatus.Active;

        /// <summary>Staff badges only — the user the badge belongs to.</summary>
        public int? UserId { get; private set; }

        /// <summary>Guest tags only — the booking the tag is issued for.</summary>
        public int? BookingId { get; private set; }

        /// <summary>Free-form access/zone label; not an enforcement mechanism.</summary>
        public string AccessLevel { get; private set; } = string.Empty;

        public DateTime? ExpiresAt { get; private set; }
        public DateTime? LastUsed { get; private set; }
        public string? Notes { get; private set; }

        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public RfidTag() { }

        private RfidTag(int propertyId, RfidTagKind kind, string tagNumber)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (string.IsNullOrWhiteSpace(tagNumber))
                throw new ArgumentException("Tag number cannot be empty.", nameof(tagNumber));

            PropertyId = propertyId;
            Kind = kind;
            TagNumber = tagNumber.Trim();
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Staff badge for a user.</summary>
        public static RfidTag ForStaff(int propertyId, int userId, string tagNumber, string accessLevel)
        {
            if (userId <= 0)
                throw new ArgumentException("UserId must be positive.", nameof(userId));

            var tag = new RfidTag(propertyId, RfidTagKind.Staff, tagNumber)
            {
                UserId = userId
            };
            tag.SetAccessLevel(accessLevel);
            return tag;
        }

        /// <summary>Guest tag for a booking. Expiry mirrors the booking when supplied.</summary>
        public static RfidTag ForGuest(int propertyId, int bookingId, string tagNumber, DateTime? expiresAt)
        {
            if (bookingId <= 0)
                throw new ArgumentException("BookingId must be positive.", nameof(bookingId));

            var tag = new RfidTag(propertyId, RfidTagKind.Guest, tagNumber)
            {
                BookingId = bookingId,
                ExpiresAt = expiresAt
            };
            tag.AccessLevel = "guest";
            return tag;
        }

        /// <summary>Free-form door/zone label — trimmed, non-empty, at most 128 chars.</summary>
        public void SetAccessLevel(string accessLevel)
        {
            if (string.IsNullOrWhiteSpace(accessLevel))
                throw new ArgumentException("Access level cannot be empty.", nameof(accessLevel));

            var trimmed = accessLevel.Trim();
            if (trimmed.Length > 128)
                throw new ArgumentException("Access level cannot exceed 128 characters.", nameof(accessLevel));

            AccessLevel = trimmed;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Revocation and restore both land here; only inactive tags can be reactivated.</summary>
        public void ChangeStatus(RfidTagStatus status)
        {
            if (status == RfidTagStatus.Active && Status != RfidTagStatus.Inactive)
                throw new DomainException("Only inactive tags can be reactivated.");

            Status = status;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Expiry is day-granular: a tag works for the whole day it expires on.</summary>
        public void RecordUse(DateTime usedAt)
        {
            if (Status != RfidTagStatus.Active)
                throw new DomainException("Tag is not active.");
            if (ExpiresAt.HasValue && usedAt.Date > ExpiresAt.Value.Date)
                throw new DomainException("Tag has expired.");

            LastUsed = usedAt;
            LastModified = usedAt;
        }

        public void SetExpiry(DateTime? expiresAt)
        {
            ExpiresAt = expiresAt;
            LastModified = DateTime.UtcNow;
        }

        public void SetNotes(string? notes)
        {
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
            LastModified = DateTime.UtcNow;
        }
    }
}
