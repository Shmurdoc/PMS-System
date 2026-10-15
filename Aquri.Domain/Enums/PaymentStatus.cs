using System;

namespace Aquri.Domain.Enums
{
    /// <summary>Lifecycle state of a <see cref="Entities.Payment"/>.</summary>
    public enum PaymentStatus
    {
        Pending = 0,
        Processing = 1,
        Completed = 2,
        Failed = 3,
        Refunded = 4,
        Cancelled = 5
    }

    public static class PaymentStatusExtensions
    {
        public static string ToWire(this PaymentStatus status) => status switch
        {
            PaymentStatus.Pending => "pending",
            PaymentStatus.Processing => "processing",
            PaymentStatus.Completed => "completed",
            PaymentStatus.Failed => "failed",
            PaymentStatus.Refunded => "refunded",
            PaymentStatus.Cancelled => "cancelled",
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, null)
        };

        public static bool TryParseWire(string? value, out PaymentStatus status)
        {
            status = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            switch (value.Trim().ToLowerInvariant())
            {
                case "pending": status = PaymentStatus.Pending; return true;
                case "processing": status = PaymentStatus.Processing; return true;
                case "completed": status = PaymentStatus.Completed; return true;
                case "failed": status = PaymentStatus.Failed; return true;
                case "refunded": status = PaymentStatus.Refunded; return true;
                case "cancelled": status = PaymentStatus.Cancelled; return true;
                default: return false;
            }
        }

        public static PaymentStatus FromWire(string value) =>
            TryParseWire(value, out var result)
                ? result
                : throw new InvalidOperationException($"Unrecognised payment status '{value}'.");
    }
}