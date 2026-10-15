using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.Inventory
{
    /// <summary>Stock-kept consumable as returned by the API.</summary>
    public class InventoryItemDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public string Name { get; init; } = string.Empty;
        public string Category { get; init; } = string.Empty;
        public int Quantity { get; init; }
        public string Unit { get; init; } = "unit";
        public int ReorderLevel { get; init; }
        public decimal Price { get; init; }
        public string Supplier { get; init; } = string.Empty;
        public string? Sku { get; init; }
        public DateTime? LastRestocked { get; init; }
        public DateTime? ExpiryDate { get; init; }
        public string? Location { get; init; }
        public int? MinOrderQuantity { get; init; }
        public string? Notes { get; init; }
        public bool NeedsReorder { get; init; }
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static InventoryItemDto FromEntity(InventoryItem item) => new()
        {
            Id = item.Id,
            PropertyId = item.PropertyId,
            Name = item.Name,
            Category = item.Category,
            Quantity = item.Quantity,
            Unit = item.Unit,
            ReorderLevel = item.ReorderLevel,
            Price = item.Price,
            Supplier = item.Supplier,
            Sku = item.Sku,
            LastRestocked = item.LastRestocked,
            ExpiryDate = item.ExpiryDate,
            Location = item.Location,
            MinOrderQuantity = item.MinOrderQuantity,
            Notes = item.Notes,
            NeedsReorder = item.NeedsReorder,
            Created = item.Created,
            LastModified = item.LastModified
        };
    }
}
