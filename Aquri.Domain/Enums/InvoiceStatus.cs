using System;

namespace Aquri.Domain.Enums
{
    /// <summary>Lifecycle state of an <see cref="Entities.Invoice"/>.</summary>
    public enum InvoiceStatus
    {
        Draft = 0,
        Pending = 1,
        Sent = 2,
        Paid = 3,
        Partial = 4,
        Overdue = 5,
        Cancelled = 6,
        Refunded = 7
    }

    /// <summary>Wire-format helpers — the DB/API contract uses lowercase hyphen-free strings.</summary>
    public static class InvoiceStatusExtensions
    {
        public static string ToWire(this InvoiceStatus status) => status switch
        {
            InvoiceStatus.Draft => "draft",
            InvoiceStatus.Pending => "pending",
            InvoiceStatus.Sent => "sent",
            InvoiceStatus.Paid => "paid",
            InvoiceStatus.Partial => "partial",
            InvoiceStatus.Overdue => "overdue",
            InvoiceStatus.Cancelled => "cancelled",
            InvoiceStatus.Refunded => "refunded",
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, null)
        };

        public static bool TryParseWire(string? value, out InvoiceStatus status)
        {
            status = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            var normalized = value.Trim().ToLowerInvariant();
            switch (normalized)
            {
                case "draft": status = InvoiceStatus.Draft; return true;
                case "pending": status = InvoiceStatus.Pending; return true;
                case "sent": status = InvoiceStatus.Sent; return true;
                case "paid": status = InvoiceStatus.Paid; return true;
                case "partial": status = InvoiceStatus.Partial; return true;
                case "overdue": status = InvoiceStatus.Overdue; return true;
                case "cancelled": status = InvoiceStatus.Cancelled; return true;
                case "refunded": status = InvoiceStatus.Refunded; return true;
                default: return false;
            }
        }

        public static InvoiceStatus FromWire(string value) =>
            TryParseWire(value, out var result)
                ? result
                : throw new InvalidOperationException($"Unrecognised invoice status '{value}'.");
    }
}