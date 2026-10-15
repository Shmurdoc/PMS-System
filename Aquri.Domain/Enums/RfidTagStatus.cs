using System;

namespace Aquri.Domain.Enums
{
    /// <summary>Lifecycle/revocation state of an <see cref="Entities.RfidTag"/>.</summary>
    public enum RfidTagStatus
    {
        Active = 0,
        Inactive = 1,
        Lost = 2,
        Blocked = 3
    }

    public static class RfidTagStatusExtensions
    {
        public static string ToWire(this RfidTagStatus status) => status switch
        {
            RfidTagStatus.Active => "active",
            RfidTagStatus.Inactive => "inactive",
            RfidTagStatus.Lost => "lost",
            RfidTagStatus.Blocked => "blocked",
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, null)
        };

        public static bool TryParseWire(string? value, out RfidTagStatus status)
        {
            status = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            switch (value.Trim().ToLowerInvariant())
            {
                case "active": status = RfidTagStatus.Active; return true;
                case "inactive": status = RfidTagStatus.Inactive; return true;
                case "lost": status = RfidTagStatus.Lost; return true;
                case "blocked": status = RfidTagStatus.Blocked; return true;
                default: return false;
            }
        }

        public static RfidTagStatus FromWire(string value) =>
            TryParseWire(value, out var result)
                ? result
                : throw new InvalidOperationException($"Unrecognised tag status '{value}'.");
    }
}
