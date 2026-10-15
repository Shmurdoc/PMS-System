using System;

namespace Aquri.Domain.Enums
{
    /// <summary>What an <see cref="Entities.RfidTag"/> is issued against.</summary>
    public enum RfidTagKind
    {
        /// <summary>Issued to a guest for the length of a booking.</summary>
        Guest = 0,

        /// <summary>Issued to a staff user as a badge for attendance/access.</summary>
        Staff = 1
    }

    public static class RfidTagKindExtensions
    {
        public static string ToWire(this RfidTagKind kind) => kind switch
        {
            RfidTagKind.Guest => "guest",
            RfidTagKind.Staff => "staff",
            _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null)
        };

        public static bool TryParseWire(string? value, out RfidTagKind kind)
        {
            kind = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            switch (value.Trim().ToLowerInvariant())
            {
                case "guest": kind = RfidTagKind.Guest; return true;
                case "staff": kind = RfidTagKind.Staff; return true;
                default: return false;
            }
        }

        public static RfidTagKind FromWire(string value) =>
            TryParseWire(value, out var result)
                ? result
                : throw new InvalidOperationException($"Unrecognised tag kind '{value}'.");
    }
}
