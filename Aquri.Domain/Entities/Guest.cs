using System;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Entities
{
    /// <summary>A hotel guest — the person a booking is made for. Segments and VIP levels drive pricing and service decisions downstream, so they're validated here.</summary>
    public class Guest
    {
        public static readonly string[] ValidSegments = { "VIP", "Frequent", "New", "Corporate" };
        public static readonly string[] ValidVipLevels = { "standard", "gold", "platinum", "diamond" };

        public int Id { get; private set; }

        /// <summary>Property this guest belongs to. Guest profiles carry passport and contact details, so they stay inside one tenant.</summary>
        public int PropertyId { get; private set; }

        public string Name { get; private set; } = string.Empty;
        public string Email { get; private set; } = string.Empty;
        public string Phone { get; private set; } = string.Empty;

        /// <summary>Government ID (passport or national ID) captured at check-in.</summary>
        public string IdNumber { get; private set; } = string.Empty;

        public string Nationality { get; private set; } = string.Empty;

        /// <summary>VIP | Frequent | New | Corporate — see <see cref="ValidSegments"/>.</summary>
        public string Segment { get; private set; } = "New";

        public int TotalStays { get; private set; }
        public int LoyaltyPoints { get; private set; }
        public string[] Preferences { get; private set; } = Array.Empty<string>();
        public string Notes { get; private set; } = string.Empty;

        public string? Address { get; private set; }
        public DateTime? DateOfBirth { get; private set; }
        public string? PassportNumber { get; private set; }
        public string? EmergencyContact { get; private set; }
        public string? EmergencyPhone { get; private set; }
        public string[] Allergies { get; private set; } = Array.Empty<string>();
        public string? VipLevel { get; private set; }
        public string? CompanyName { get; private set; }

        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public Guest() { }

        public Guest(string name, string email, string phone, string idNumber, string nationality)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Guest name cannot be empty.", nameof(name));
            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Guest email cannot be empty.", nameof(email));
            if (string.IsNullOrWhiteSpace(phone))
                throw new ArgumentException("Guest phone cannot be empty.", nameof(phone));

            Name = name.Trim();
            Email = email.Trim();
            Phone = phone.Trim();
            IdNumber = idNumber?.Trim() ?? string.Empty;
            Nationality = nationality?.Trim() ?? string.Empty;
            Segment = "New";
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Puts the guest under a property. Called once when the guest is created.</summary>
        public void AssignProperty(int propertyId)
        {
            if (propertyId <= 0)
                throw new ArgumentException("Property id must be positive.", nameof(propertyId));

            PropertyId = propertyId;
            LastModified = DateTime.UtcNow;
        }

        public void RecordStay(int pointsEarned)
        {
            if (pointsEarned < 0)
                throw new ArgumentException("Points earned cannot be negative.", nameof(pointsEarned));

            TotalStays++;
            LoyaltyPoints += pointsEarned;
            LastModified = DateTime.UtcNow;
        }

        public void SpendLoyaltyPoints(int points)
        {
            if (points <= 0)
                throw new ArgumentException("Points to spend must be positive.", nameof(points));
            if (points > LoyaltyPoints)
                throw new DomainException("Not enough loyalty points.");

            LoyaltyPoints -= points;
            LastModified = DateTime.UtcNow;
        }

        public void ChangeSegment(string newSegment)
        {
            if (!ValidSegments.Contains(newSegment))
                throw new ArgumentException($"Segment must be one of: {string.Join(", ", ValidSegments)}.", nameof(newSegment));

            Segment = newSegment;
            LastModified = DateTime.UtcNow;
        }

        public void SetVipLevel(string level)
        {
            if (!ValidVipLevels.Contains(level))
                throw new ArgumentException($"VIP level must be one of: {string.Join(", ", ValidVipLevels)}.", nameof(level));

            VipLevel = level;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Full profile update — the usual front-desk edit form.</summary>
        public void UpdateProfile(
            string name, string phone, string nationality,
            string? address, string? emergencyContact, string? emergencyPhone, string notes)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Guest name cannot be empty.", nameof(name));

            Name = name.Trim();
            Phone = phone?.Trim() ?? Phone;
            Nationality = nationality?.Trim() ?? Nationality;
            Address = address;
            EmergencyContact = emergencyContact;
            EmergencyPhone = emergencyPhone;
            Notes = notes ?? string.Empty;
            LastModified = DateTime.UtcNow;
        }

        public void SetAllergies(string[] allergies) =>
            Allergies = allergies ?? Array.Empty<string>();

        public void SetPreferences(string[] preferences) =>
            Preferences = preferences ?? Array.Empty<string>();
    }
}
