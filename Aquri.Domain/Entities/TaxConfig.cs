using System;

namespace Aquri.Domain.Entities
{
    /// <summary>A tax or levy rule — South African VAT (15%), tourism levy (1%), city tax, service charge. Has a validity window so historical invoices keep the rate that applied when they were issued.</summary>
    public class TaxConfig
    {
        public static readonly string[] ValidTypes = { "vat", "sales_tax", "tourism_levy", "city_tax", "service_charge" };

        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public string Name { get; private set; } = string.Empty;

        /// <summary>Fraction, e.g. 0.15 for 15% VAT.</summary>
        public decimal Rate { get; private set; }

        /// <summary>vat | sales_tax | tourism_levy | city_tax | service_charge.</summary>
        public string Type { get; private set; } = "vat";

        /// <summary>True when the rate is already baked into listed prices.</summary>
        public bool Included { get; private set; }
        public string[] ApplicableTo { get; private set; } = Array.Empty<string>();
        public DateTime ValidFrom { get; private set; }
        public DateTime? ValidTo { get; private set; }
        public bool Active { get; private set; }
        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public TaxConfig() { }

        public TaxConfig(int propertyId, string name, decimal rate, string type, DateTime validFrom)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name cannot be empty.", nameof(name));
            if (rate < 0 || rate > 1)
                throw new ArgumentException("Rate must be between 0 and 1 (e.g. 0.15).", nameof(rate));
            if (!ValidTypes.Contains(type))
                throw new ArgumentException($"Type must be one of: {string.Join(", ", ValidTypes)}.", nameof(type));

            PropertyId = propertyId;
            Name = name.Trim();
            Rate = rate;
            Type = type;
            ValidFrom = validFrom;
            Active = true;
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>True when the rule is active on the given date.</summary>
        public bool AppliesOn(DateTime date) =>
            Active && date >= ValidFrom && (ValidTo is null || date <= ValidTo);

        public void UpdateRate(decimal rate)
        {
            if (rate < 0 || rate > 1)
                throw new ArgumentException("Rate must be between 0 and 1 (e.g. 0.15).", nameof(rate));

            Rate = rate;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Ends the current window so a new rate can supersede it.</summary>
        public void End(DateTime validTo)
        {
            if (validTo < ValidFrom)
                throw new ArgumentException("Valid-to cannot be before valid-from.", nameof(validTo));

            ValidTo = validTo;
            LastModified = DateTime.UtcNow;
        }

        public void SetIncluded(bool included)
        {
            Included = included;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Sets which charge codes the rule applies to (e.g. room, food, bar).</summary>
        public void SetApplicableTo(string[]? applicableTo)
        {
            ApplicableTo = applicableTo ?? Array.Empty<string>();
            LastModified = DateTime.UtcNow;
        }

        public void Deactivate()
        {
            Active = false;
            LastModified = DateTime.UtcNow;
        }
    }
}
