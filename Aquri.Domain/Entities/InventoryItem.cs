using System;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// A stock-kept consumable — towels, minibar sodas, cleaning chemicals.
    /// Tracks quantity against a reorder level so housekeeping knows what to
    /// order before something runs out.
    /// </summary>
    public class InventoryItem
    {
        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public string Name { get; private set; } = string.Empty;
        public string Category { get; private set; } = string.Empty;
        public int Quantity { get; private set; }
        public string Unit { get; private set; } = "unit";
        public int ReorderLevel { get; private set; }
        public decimal Price { get; private set; }
        public string Supplier { get; private set; } = string.Empty;
        public string? Sku { get; private set; }
        public DateTime? LastRestocked { get; private set; }
        public DateTime? ExpiryDate { get; private set; }
        public string? Location { get; private set; }
        public int? MinOrderQuantity { get; private set; }
        public string? Notes { get; private set; }
        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public InventoryItem() { }

        public InventoryItem(int propertyId, string name, string category, int quantity, string unit, int reorderLevel, decimal price, string supplier)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name cannot be empty.", nameof(name));
            if (string.IsNullOrWhiteSpace(category))
                throw new ArgumentException("Category cannot be empty.", nameof(category));
            if (quantity < 0)
                throw new ArgumentException("Quantity cannot be negative.", nameof(quantity));
            if (reorderLevel < 0)
                throw new ArgumentException("Reorder level cannot be negative.", nameof(reorderLevel));
            if (price < 0)
                throw new ArgumentException("Price cannot be negative.", nameof(price));

            PropertyId = propertyId;
            Name = name.Trim();
            Category = category.Trim();
            Quantity = quantity;
            Unit = string.IsNullOrWhiteSpace(unit) ? "unit" : unit.Trim();
            ReorderLevel = reorderLevel;
            Price = price;
            Supplier = supplier?.Trim() ?? string.Empty;
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>True when stock has dipped to or below the reorder level.</summary>
        public bool NeedsReorder => Quantity <= ReorderLevel;

        public void AdjustQuantity(int delta)
        {
            if (Quantity + delta < 0)
                throw new DomainException("Quantity cannot go below zero.");

            Quantity += delta;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Records a delivery: bumps quantity and stamps the restock date.</summary>
        public void Restock(int quantityAdded)
        {
            if (quantityAdded < 1)
                throw new ArgumentException("Quantity added must be at least 1.", nameof(quantityAdded));

            Quantity += quantityAdded;
            LastRestocked = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Updates item details (name, category, pricing, ordering info).</summary>
        public void UpdateDetails(string name, string category, string unit, int reorderLevel,
            decimal price, string supplier, string? location, string? notes)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name cannot be empty.", nameof(name));
            if (string.IsNullOrWhiteSpace(category))
                throw new ArgumentException("Category cannot be empty.", nameof(category));
            if (reorderLevel < 0)
                throw new ArgumentException("Reorder level cannot be negative.", nameof(reorderLevel));
            if (price < 0)
                throw new ArgumentException("Price cannot be negative.", nameof(price));

            Name = name.Trim();
            Category = category.Trim();
            Unit = string.IsNullOrWhiteSpace(unit) ? "unit" : unit.Trim();
            ReorderLevel = reorderLevel;
            Price = price;
            Supplier = supplier?.Trim() ?? string.Empty;
            Location = location?.Trim();
            Notes = notes?.Trim();
            LastModified = DateTime.UtcNow;
        }

        public void SetExpiry(DateTime? expiryDate)
        {
            ExpiryDate = expiryDate;
            LastModified = DateTime.UtcNow;
        }

        public void SetSku(string? sku)
        {
            Sku = string.IsNullOrWhiteSpace(sku) ? null : sku.Trim();
            LastModified = DateTime.UtcNow;
        }

        public void SetMinOrderQuantity(int? minOrderQuantity)
        {
            if (minOrderQuantity is < 1)
                throw new ArgumentException("Minimum order quantity must be at least 1.", nameof(minOrderQuantity));

            MinOrderQuantity = minOrderQuantity;
            LastModified = DateTime.UtcNow;
        }
    }
}
