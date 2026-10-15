using System;

namespace Aquri.Domain.Enums
{
    /// <summary>Payment settlement state of a <see cref="Entities.Booking"/>.</summary>
    public enum BookingPaymentStatus
    {
        Pending = 0,
        Partial = 1,
        Paid = 2,
        Refunded = 3
    }

    public static class BookingPaymentStatusExtensions
    {
        public static string ToWire(this BookingPaymentStatus status) => status switch
        {
            BookingPaymentStatus.Pending => "pending",
            BookingPaymentStatus.Partial => "partial",
            BookingPaymentStatus.Paid => "paid",
            BookingPaymentStatus.Refunded => "refunded",
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, null)
        };

        public static bool TryParseWire(string? value, out BookingPaymentStatus status)
        {
            status = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            switch (value.Trim().ToLowerInvariant())
            {
                case "pending": status = BookingPaymentStatus.Pending; return true;
                case "partial": status = BookingPaymentStatus.Partial; return true;
                case "paid": status = BookingPaymentStatus.Paid; return true;
                case "refunded": status = BookingPaymentStatus.Refunded; return true;
                default: return false;
            }
        }

        public static BookingPaymentStatus FromWire(string value) =>
            TryParseWire(value, out var result)
                ? result
                : throw new InvalidOperationException($"Unrecognised booking payment status '{value}'.");
    }
}