using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.Electricity
{
    /// <summary>A meter reading as returned by the API.</summary>
    public class ElectricityRecordDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public DateTime Date { get; init; }
        public decimal Consumption { get; init; }
        public decimal Cost { get; init; }
        public decimal PeakDemand { get; init; }
        public string Zone { get; init; } = string.Empty;
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static ElectricityRecordDto FromEntity(ElectricityRecord record) => new()
        {
            Id = record.Id,
            PropertyId = record.PropertyId,
            Date = record.Date,
            Consumption = record.Consumption,
            Cost = record.Cost,
            PeakDemand = record.PeakDemand,
            Zone = record.Zone,
            Created = record.Created,
            LastModified = record.LastModified
        };
    }
}
