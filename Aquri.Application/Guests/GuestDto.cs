using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.Guests
{
    /// <summary>Guest as returned by the API — shaped for the frontend guest list.</summary>
    public class GuestDto
    {
        public int Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public string Email { get; init; } = string.Empty;
        public string Phone { get; init; } = string.Empty;
        public string IdNumber { get; init; } = string.Empty;
        public string Nationality { get; init; } = string.Empty;
        public string Segment { get; init; } = string.Empty;
        public int TotalStays { get; init; }
        public int LoyaltyPoints { get; init; }
        public string[] Preferences { get; init; } = Array.Empty<string>();
        public string Notes { get; init; } = string.Empty;
        public string? Address { get; init; }
        public DateTime? DateOfBirth { get; init; }
        public string? PassportNumber { get; init; }
        public string? EmergencyContact { get; init; }
        public string? EmergencyPhone { get; init; }
        public string[] Allergies { get; init; } = Array.Empty<string>();
        public string? VipLevel { get; init; }
        public string? CompanyName { get; init; }
        public DateTime Created { get; init; }

        public static GuestDto FromEntity(Guest guest) => new()
        {
            Id = guest.Id,
            Name = guest.Name,
            Email = guest.Email,
            Phone = guest.Phone,
            IdNumber = guest.IdNumber,
            Nationality = guest.Nationality,
            Segment = guest.Segment,
            TotalStays = guest.TotalStays,
            LoyaltyPoints = guest.LoyaltyPoints,
            Preferences = guest.Preferences,
            Notes = guest.Notes,
            Address = guest.Address,
            DateOfBirth = guest.DateOfBirth,
            PassportNumber = guest.PassportNumber,
            EmergencyContact = guest.EmergencyContact,
            EmergencyPhone = guest.EmergencyPhone,
            Allergies = guest.Allergies,
            VipLevel = guest.VipLevel,
            CompanyName = guest.CompanyName,
            Created = guest.Created
        };
    }
}
