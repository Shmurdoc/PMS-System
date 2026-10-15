using System;

namespace Aquri.Domain.Enums
{
    /// <summary>Operational state of a <see cref="Entities.Room"/>.</summary>
    public enum RoomStatus
    {
        Available = 0,
        Occupied = 1,
        Reserved = 2,
        Cleaning = 3,
        Maintenance = 4
    }

    public static class RoomStatusExtensions
    {
        public static string ToWire(this RoomStatus status) => status switch
        {
            RoomStatus.Available => "available",
            RoomStatus.Occupied => "occupied",
            RoomStatus.Reserved => "reserved",
            RoomStatus.Cleaning => "cleaning",
            RoomStatus.Maintenance => "maintenance",
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, null)
        };

        public static bool TryParseWire(string? value, out RoomStatus status)
        {
            status = default;
            if (string.IsNullOrWhiteSpace(value)) return false;
            switch (value.Trim().ToLowerInvariant())
            {
                case "available": status = RoomStatus.Available; return true;
                case "occupied": status = RoomStatus.Occupied; return true;
                case "reserved": status = RoomStatus.Reserved; return true;
                case "cleaning": status = RoomStatus.Cleaning; return true;
                case "maintenance": status = RoomStatus.Maintenance; return true;
                default: return false;
            }
        }

        public static RoomStatus FromWire(string value) =>
            TryParseWire(value, out var result)
                ? result
                : throw new InvalidOperationException($"Unrecognised room status '{value}'.");
    }
}