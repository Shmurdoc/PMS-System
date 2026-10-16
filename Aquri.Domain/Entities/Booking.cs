using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Entities
{
    /// <summary>A reservation: who is staying, in which room, on which dates, and what the money situation is. Status moves through a fixed lifecycle — see <see cref="CanTransitionTo"/> — so handlers can't put a booking in a nonsense state.</summary>
    public class Booking
    {
        private static readonly IReadOnlyDictionary<BookingStatus, BookingStatus[]> AllowedTransitions =
            new ReadOnlyDictionary<BookingStatus, BookingStatus[]>(new Dictionary<BookingStatus, BookingStatus[]>
            {
                [BookingStatus.Pending]    = new[] { BookingStatus.Confirmed, BookingStatus.Cancelled, BookingStatus.NoShow },
                [BookingStatus.Confirmed]  = new[] { BookingStatus.CheckedIn, BookingStatus.Cancelled, BookingStatus.NoShow },
                [BookingStatus.CheckedIn]  = new[] { BookingStatus.CheckedOut },
                [BookingStatus.CheckedOut] = Array.Empty<BookingStatus>(),
                [BookingStatus.Cancelled]  = Array.Empty<BookingStatus>(),
                [BookingStatus.NoShow]     = Array.Empty<BookingStatus>(),
            });

        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public int GuestId { get; private set; }
        public int RoomId { get; private set; }

        public DateTime CheckIn { get; private set; }
        public DateTime CheckOut { get; private set; }
        public int Nights { get; private set; }
        public int Guests { get; private set; }
        public int? Adults { get; private set; }
        public int? Children { get; private set; }

        public BookingStatus Status { get; private set; } = BookingStatus.Pending;
        public BookingPaymentStatus PaymentStatus { get; private set; } = BookingPaymentStatus.Pending;

        /// <summary>Total booking value in ZAR.</summary>
        public decimal Amount { get; private set; }
        public decimal RatePerNight { get; private set; }
        public decimal DepositPaid { get; private set; }

        /// <summary>How the booking arrived: direct, booking.com, expedia, walk-in, etc.</summary>
        public string Source { get; private set; } = "direct";

        public string? SpecialRequests { get; private set; }
        public string? Notes { get; private set; }
        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public Guest? Guest { get; private set; }
        public Room? Room { get; private set; }

        public Booking() { }

        public Booking(
            int propertyId, int guestId, int roomId,
            DateTime checkIn, DateTime checkOut, int guests,
            decimal ratePerNight, string source)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (guestId <= 0)
                throw new ArgumentException("GuestId must be positive.", nameof(guestId));
            if (roomId <= 0)
                throw new ArgumentException("RoomId must be positive.", nameof(roomId));
            if (checkOut <= checkIn)
                throw new ArgumentException("Check-out must be after check-in.", nameof(checkOut));
            if (guests < 1)
                throw new ArgumentException("At least one guest is required.", nameof(guests));
            if (ratePerNight < 0)
                throw new ArgumentException("Rate per night cannot be negative.", nameof(ratePerNight));

            PropertyId = propertyId;
            GuestId = guestId;
            RoomId = roomId;
            CheckIn = checkIn;
            CheckOut = checkOut;
            Nights = (int)(checkOut - checkIn).TotalDays;
            Guests = guests;
            RatePerNight = ratePerNight;
            Amount = ratePerNight * Nights;
            Source = string.IsNullOrWhiteSpace(source) ? "direct" : source.Trim();
            Status = BookingStatus.Pending;
            PaymentStatus = BookingPaymentStatus.Pending;
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public static bool CanTransitionTo(BookingStatus from, BookingStatus to) =>
            AllowedTransitions.TryGetValue(from, out var allowed) && Array.Exists(allowed, s => s == to);

        /// <summary>Moves the booking to its next lifecycle state, refusing jumps that don't make sense (e.g. checked-out without checking in first).</summary>
        public void ChangeStatus(BookingStatus newStatus)
        {
            if (!CanTransitionTo(Status, newStatus))
                throw new DomainException($"Cannot move a booking from '{Status.ToWire()}' to '{newStatus.ToWire()}'.");

            Status = newStatus;
            LastModified = DateTime.UtcNow;
        }

        public void ChangePaymentStatus(BookingPaymentStatus newPaymentStatus)
        {
            PaymentStatus = newPaymentStatus;
            LastModified = DateTime.UtcNow;
        }

        public void RecordDeposit(decimal amount)
        {
            if (amount <= 0)
                throw new ArgumentException("Deposit must be positive.", nameof(amount));
            if (DepositPaid + amount > Amount)
                throw new DomainException("Deposit would exceed the booking total.");

            DepositPaid += amount;
            PaymentStatus = DepositPaid >= Amount ? BookingPaymentStatus.Paid : BookingPaymentStatus.Partial;
            LastModified = DateTime.UtcNow;
        }

        public void SetSpecialRequests(string? specialRequests)
        {
            SpecialRequests = specialRequests;
            LastModified = DateTime.UtcNow;
        }

        public void SetNotes(string? notes)
        {
            Notes = notes;
            LastModified = DateTime.UtcNow;
        }
    }
}
