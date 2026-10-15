using System;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;

namespace Aquri.Application.Bookings
{
    /// <summary>Booking as returned by the API — includes related guest/room info when available.</summary>
    public class BookingDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public int GuestId { get; init; }
        public int RoomId { get; init; }
        public string? GuestName { get; init; }
        public string? RoomNumber { get; init; }
        public DateTime CheckIn { get; init; }
        public DateTime CheckOut { get; init; }
        public int Nights { get; init; }
        public int Guests { get; init; }
        public string Status { get; init; } = string.Empty;
        public string PaymentStatus { get; init; } = string.Empty;
        public decimal Amount { get; init; }
        public decimal RatePerNight { get; init; }
        public decimal DepositPaid { get; init; }
        public string Source { get; init; } = string.Empty;
        public string? SpecialRequests { get; init; }
        public string? Notes { get; init; }
        public DateTime Created { get; init; }

        public static BookingDto FromEntity(Booking booking) => new()
        {
            Id = booking.Id,
            PropertyId = booking.PropertyId,
            GuestId = booking.GuestId,
            RoomId = booking.RoomId,
            GuestName = booking.Guest?.Name,
            RoomNumber = booking.Room?.Number,
            CheckIn = booking.CheckIn,
            CheckOut = booking.CheckOut,
            Nights = booking.Nights,
            Guests = booking.Guests,
            Status = booking.Status.ToWire(),
            PaymentStatus = booking.PaymentStatus.ToWire(),
            Amount = booking.Amount,
            RatePerNight = booking.RatePerNight,
            DepositPaid = booking.DepositPaid,
            Source = booking.Source,
            SpecialRequests = booking.SpecialRequests,
            Notes = booking.Notes,
            Created = booking.Created
        };
    }
}
