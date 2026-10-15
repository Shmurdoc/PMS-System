using System;

namespace Aquri.Domain.Enums
{
    /// <summary>What kind of work a <see cref="Entities.Ticket"/> represents.</summary>
    public enum TicketType
    {
        Issue = 0,
        Task = 1,
        Request = 2,
        Incident = 3
    }

    public static class TicketTypeExtensions
    {
        public static string ToWire(this TicketType type) => type switch
        {
            TicketType.Issue => "issue",
            TicketType.Task => "task",
            TicketType.Request => "request",
            TicketType.Incident => "incident",
            _ => throw new ArgumentOutOfRangeException(nameof(type), type, null)
        };

        public static bool TryParseWire(string? value, out TicketType type)
        {
            type = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            switch (value.Trim().ToLowerInvariant())
            {
                case "issue": type = TicketType.Issue; return true;
                case "task": type = TicketType.Task; return true;
                case "request": type = TicketType.Request; return true;
                case "incident": type = TicketType.Incident; return true;
                default: return false;
            }
        }

        public static TicketType FromWire(string value) =>
            TryParseWire(value, out var result)
                ? result
                : throw new InvalidOperationException($"Unrecognised ticket type '{value}'.");
    }
}