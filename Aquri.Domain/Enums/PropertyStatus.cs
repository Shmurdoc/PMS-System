using System;

namespace Aquri.Domain.Enums
{
    /// <summary>Lifecycle state of a <see cref="Entities.Property"/>.</summary>
    public enum PropertyStatus
    {
        Active = 0,
        Maintenance = 1,
        Retired = 2
    }

    public static class PropertyStatusExtensions
    {
        public static string ToWire(this PropertyStatus status) => status switch
        {
            PropertyStatus.Active => "active",
            PropertyStatus.Maintenance => "maintenance",
            PropertyStatus.Retired => "retired",
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, null)
        };
    }
}
