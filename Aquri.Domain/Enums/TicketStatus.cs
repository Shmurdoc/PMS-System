using System;

namespace Aquri.Domain.Enums
{
    /// <summary>Lifecycle state of a <see cref="Entities.Ticket"/>.</summary>
    public enum TicketStatus
    {
        Open = 0,
        InProgress = 1,
        Pending = 2,
        Resolved = 3,
        Closed = 4,
        Cancelled = 5
    }

    public static class TicketStatusExtensions
    {
        public static string ToWire(this TicketStatus status) => status switch
        {
            TicketStatus.Open => "open",
            TicketStatus.InProgress => "in_progress",
            TicketStatus.Pending => "pending",
            TicketStatus.Resolved => "resolved",
            TicketStatus.Closed => "closed",
            TicketStatus.Cancelled => "cancelled",
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, null)
        };

        public static bool TryParseWire(string? value, out TicketStatus status)
        {
            status = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            switch (value.Trim().ToLowerInvariant())
            {
                case "open": status = TicketStatus.Open; return true;
                case "in_progress":
                case "in-progress": status = TicketStatus.InProgress; return true;
                case "pending": status = TicketStatus.Pending; return true;
                case "resolved": status = TicketStatus.Resolved; return true;
                case "closed": status = TicketStatus.Closed; return true;
                case "cancelled": status = TicketStatus.Cancelled; return true;
                default: return false;
            }
        }

        public static TicketStatus FromWire(string value) =>
            TryParseWire(value, out var result)
                ? result
                : throw new InvalidOperationException($"Unrecognised ticket status '{value}'.");
    }
}