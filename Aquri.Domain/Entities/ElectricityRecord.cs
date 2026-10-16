using System;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// A meter reading for one zone of a property on a given day — kilowatt
    /// hours consumed, the cost, and the peak demand. Costs are in the
    /// property's reporting currency, not converted.
    /// </summary>
    public class ElectricityRecord
    {
        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public DateTime Date { get; private set; }
        public decimal Consumption { get; private set; }
        public decimal Cost { get; private set; }
        public decimal PeakDemand { get; private set; }
        public string Zone { get; private set; } = string.Empty;
        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public ElectricityRecord() { }

        public ElectricityRecord(int propertyId, DateTime date, decimal consumption, decimal cost, decimal peakDemand, string? zone)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (consumption < 0)
                throw new ArgumentException("Consumption cannot be negative.", nameof(consumption));
            if (cost < 0)
                throw new ArgumentException("Cost cannot be negative.", nameof(cost));
            if (peakDemand < 0)
                throw new ArgumentException("PeakDemand cannot be negative.", nameof(peakDemand));

            PropertyId = propertyId;
            Date = date;
            Consumption = consumption;
            Cost = cost;
            PeakDemand = peakDemand;
            Zone = zone?.Trim() ?? string.Empty;
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Edits the reading in place (sparse — pass null to keep a value).</summary>
        public void Update(DateTime? date, decimal? consumption, decimal? cost, decimal? peakDemand, string? zone)
        {
            if (consumption < 0)
                throw new ArgumentException("Consumption cannot be negative.", nameof(consumption));
            if (cost < 0)
                throw new ArgumentException("Cost cannot be negative.", nameof(cost));
            if (peakDemand < 0)
                throw new ArgumentException("PeakDemand cannot be negative.", nameof(peakDemand));

            if (date.HasValue)
                Date = date.Value;
            if (consumption.HasValue)
                Consumption = consumption.Value;
            if (cost.HasValue)
                Cost = cost.Value;
            if (peakDemand.HasValue)
                PeakDemand = peakDemand.Value;
            if (zone is not null)
                Zone = zone.Trim();
            LastModified = DateTime.UtcNow;
        }
    }
}
