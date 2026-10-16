using System;

namespace Aquri.Domain.Entities
{
    /// <summary>One billable line on an invoice — a night, a minibar charge, a late checkout fee. Amount is derived (quantity × unit price), so it's never set directly.</summary>
    public class InvoiceItem
    {
        public int Id { get; private set; }
        public int InvoiceId { get; private set; }

        public string Description { get; private set; } = string.Empty;
        public int Quantity { get; private set; }
        public decimal UnitPrice { get; private set; }

        /// <summary>Effective tax rate for this line, e.g. 0.15 for VAT.</summary>
        public decimal TaxRate { get; private set; }

        /// <summary>Quantity × UnitPrice. Tax sits on the invoice total, not here.</summary>
        public decimal Amount { get; private set; }

        /// <summary>Free-text bucket: room, food_beverage, laundry, spa, etc.</summary>
        public string Category { get; private set; } = "other";

        public InvoiceItem() { }

        public InvoiceItem(string description, int quantity, decimal unitPrice, decimal taxRate, string category)
        {
            if (string.IsNullOrWhiteSpace(description))
                throw new ArgumentException("Description cannot be empty.", nameof(description));
            if (quantity < 1)
                throw new ArgumentException("Quantity must be at least 1.", nameof(quantity));
            if (unitPrice < 0)
                throw new ArgumentException("Unit price cannot be negative.", nameof(unitPrice));
            if (taxRate < 0 || taxRate > 1)
                throw new ArgumentException("Tax rate must be between 0 and 1 (e.g. 0.15).", nameof(taxRate));

            Description = description.Trim();
            Quantity = quantity;
            UnitPrice = unitPrice;
            TaxRate = taxRate;
            Amount = quantity * unitPrice;
            Category = string.IsNullOrWhiteSpace(category) ? "other" : category.Trim();
        }

        public void UpdateQuantity(int quantity)
        {
            if (quantity < 1)
                throw new ArgumentException("Quantity must be at least 1.", nameof(quantity));

            Quantity = quantity;
            Amount = quantity * UnitPrice;
        }

        public void UpdateUnitPrice(decimal unitPrice)
        {
            if (unitPrice < 0)
                throw new ArgumentException("Unit price cannot be negative.", nameof(unitPrice));

            UnitPrice = unitPrice;
            Amount = Quantity * unitPrice;
        }
    }
}
