using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.TaxConfigs
{
    /// <summary>Tax or levy rule as returned by the API.</summary>
    public class TaxConfigDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public string Name { get; init; } = string.Empty;

        /// <summary>Fraction, e.g. 0.15 for 15% VAT.</summary>
        public decimal Rate { get; init; }
        public string Type { get; init; } = "vat";
        public bool Included { get; init; }
        public string[] ApplicableTo { get; init; } = Array.Empty<string>();
        public DateTime ValidFrom { get; init; }
        public DateTime? ValidTo { get; init; }
        public bool Active { get; init; }
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static TaxConfigDto FromEntity(TaxConfig tax) => new()
        {
            Id = tax.Id,
            PropertyId = tax.PropertyId,
            Name = tax.Name,
            Rate = tax.Rate,
            Type = tax.Type,
            Included = tax.Included,
            ApplicableTo = tax.ApplicableTo,
            ValidFrom = tax.ValidFrom,
            ValidTo = tax.ValidTo,
            Active = tax.Active,
            Created = tax.Created,
            LastModified = tax.LastModified
        };
    }
}
