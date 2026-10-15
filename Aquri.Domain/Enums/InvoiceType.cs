using System;

namespace Aquri.Domain.Enums
{
    /// <summary>What an invoice is for.</summary>
    public enum InvoiceType
    {
        Booking = 0,
        Service = 1,
        Advance = 2,
        Final = 3
    }

    public static class InvoiceTypeExtensions
    {
        public static string ToWire(this InvoiceType type) => type switch
        {
            InvoiceType.Booking => "booking",
            InvoiceType.Service => "service",
            InvoiceType.Advance => "advance",
            InvoiceType.Final => "final",
            _ => throw new ArgumentOutOfRangeException(nameof(type), type, null)
        };

        public static bool TryParseWire(string? value, out InvoiceType type)
        {
            type = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            switch (value.Trim().ToLowerInvariant())
            {
                case "booking": type = InvoiceType.Booking; return true;
                case "service": type = InvoiceType.Service; return true;
                case "advance": type = InvoiceType.Advance; return true;
                case "final": type = InvoiceType.Final; return true;
                default: return false;
            }
        }

        public static InvoiceType FromWire(string value) =>
            TryParseWire(value, out var result)
                ? result
                : throw new InvalidOperationException($"Unrecognised invoice type '{value}'.");
    }
}