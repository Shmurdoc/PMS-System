using System;

namespace Aquri.Domain.Enums
{
    /// <summary>Lifecycle state of a <see cref="Entities.Booking"/>.</summary>
    public enum BookingStatus
    {
        Pending = 0,
        Confirmed = 1,
        CheckedIn = 2,
        CheckedOut = 3,
        Cancelled = 4,
        NoShow = 5
    }

    public static class BookingStatusExtensions
    {
        public static string ToWire(this BookingStatus status) => status switch
        {
            BookingStatus.Pending => "pending",
            BookingStatus.Confirmed => "confirmed",
            BookingStatus.CheckedIn => "checked-in",
            BookingStatus.CheckedOut => "checked-out",
            BookingStatus.Cancelled => "cancelled",
            BookingStatus.NoShow => "no-show",
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, null)
        };

        public static bool TryParseWire(string? value, out BookingStatus status)
        {
            status = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            switch (value.Trim().ToLowerInvariant())
            {
                case "pending": status = BookingStatus.Pending; return true;
                case "confirmed": status = BookingStatus.Confirmed; return true;
                case "checked-in":
                case "checked_in": status = BookingStatus.CheckedIn; return true;
                case "checked-out":
                case "checked_out": status = BookingStatus.CheckedOut; return true;
                case "cancelled": status = BookingStatus.Cancelled; return true;
                case "no-show":
                case "no_show": status = BookingStatus.NoShow; return true;
                default: return false;
            }
        }

        public static BookingStatus FromWire(string value) =>
            TryParseWire(value, out var result)
                ? result
                : throw new InvalidOperationException($"Unrecognised booking status '{value}'.");
    }
}