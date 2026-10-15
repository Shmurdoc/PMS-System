using System;

namespace Aquri.Domain.Enums
{
    /// <summary>Urgency of a <see cref="Entities.Ticket"/>.</summary>
    public enum TicketPriority
    {
        Low = 0,
        Medium = 1,
        High = 2,
        Urgent = 3,
        Critical = 4
    }

    public static class TicketPriorityExtensions
    {
        public static string ToWire(this TicketPriority priority) => priority switch
        {
            TicketPriority.Low => "low",
            TicketPriority.Medium => "medium",
            TicketPriority.High => "high",
            TicketPriority.Urgent => "urgent",
            TicketPriority.Critical => "critical",
            _ => throw new ArgumentOutOfRangeException(nameof(priority), priority, null)
        };

        public static bool TryParseWire(string? value, out TicketPriority priority)
        {
            priority = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            switch (value.Trim().ToLowerInvariant())
            {
                case "low": priority = TicketPriority.Low; return true;
                case "medium": priority = TicketPriority.Medium; return true;
                case "high": priority = TicketPriority.High; return true;
                case "urgent": priority = TicketPriority.Urgent; return true;
                case "critical": priority = TicketPriority.Critical; return true;
                default: return false;
            }
        }

        public static TicketPriority FromWire(string value) =>
            TryParseWire(value, out var result)
                ? result
                : throw new InvalidOperationException($"Unrecognised ticket priority '{value}'.");
    }
}