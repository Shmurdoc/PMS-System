using System;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// A pricing plan — base rate for a set of room types in a season, with
    /// stay restrictions (e.g. "high season, min 2 nights, no same-day").
    /// </summary>
    public class RatePlan
    {
        public static readonly string[] ValidSeasons = { "low", "shoulder", "high", "peak" };

        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public string Name { get; private set; } = string.Empty;
        public string[] RoomTypes { get; private set; } = Array.Empty<string>();
        public decimal BaseRate { get; private set; }

        /// <summary>low | shoulder | high | peak.</summary>
        public string Season { get; private set; } = "low";
        public int MinStay { get; private set; }
        public bool Active { get; private set; }
        public string[] Restrictions { get; private set; } = Array.Empty<string>();
        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public RatePlan() { }

        public RatePlan(int propertyId, string name, decimal baseRate, string season, int minStay)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Plan name cannot be empty.", nameof(name));
            if (baseRate < 0)
                throw new ArgumentException("Base rate cannot be negative.", nameof(baseRate));
            if (!ValidSeasons.Contains(season))
                throw new ArgumentException($"Season must be one of: {string.Join(", ", ValidSeasons)}.", nameof(season));
            if (minStay < 1)
                throw new ArgumentException("Minimum stay must be at least 1 night.", nameof(minStay));

            PropertyId = propertyId;
            Name = name.Trim();
            BaseRate = baseRate;
            Season = season;
            MinStay = minStay;
            Active = true;
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public void UpdateBaseRate(decimal baseRate)
        {
            if (baseRate < 0)
                throw new ArgumentException("Base rate cannot be negative.", nameof(baseRate));

            BaseRate = baseRate;
            LastModified = DateTime.UtcNow;
        }

        public void SetRoomTypes(string[] roomTypes)
        {
            RoomTypes = roomTypes ?? Array.Empty<string>();
            LastModified = DateTime.UtcNow;
        }

        public void SetRestrictions(string[] restrictions)
        {
            Restrictions = restrictions ?? Array.Empty<string>();
            LastModified = DateTime.UtcNow;
        }

        public void Activate()
        {
            Active = true;
            LastModified = DateTime.UtcNow;
        }

        public void Deactivate()
        {
            Active = false;
            LastModified = DateTime.UtcNow;
        }
    }
}
