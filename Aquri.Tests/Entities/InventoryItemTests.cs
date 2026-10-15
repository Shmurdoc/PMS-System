using Aquri.Domain.Entities;
using Aquri.Domain.Exceptions;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class InventoryItemTests
    {
        private static InventoryItem NewItem(int qty = 50, int reorder = 20) =>
            new(1, "Bath towels", "linen", qty, "piece", reorder, 45m, "LinenCo");

        [Fact]
        public void Constructor_Valid()
        {
            var item = NewItem();

            item.Name.Should().Be("Bath towels");
            item.Unit.Should().Be("piece");
            item.NeedsReorder.Should().BeFalse();
        }

        [Fact]
        public void NeedsReorder_AtOrBelowLevel()
        {
            NewItem(qty: 20, reorder: 20).NeedsReorder.Should().BeTrue();
            NewItem(qty: 19, reorder: 20).NeedsReorder.Should().BeTrue();
            NewItem(qty: 21, reorder: 20).NeedsReorder.Should().BeFalse();
        }

        [Fact]
        public void Restock_BumpsQuantityAndTimestamp()
        {
            var item = NewItem(qty: 10);

            item.Restock(25);

            item.Quantity.Should().Be(35);
            item.LastRestocked.Should().NotBeNull();
        }

        [Fact]
        public void AdjustQuantity_BelowZero_Throws()
        {
            var item = NewItem(qty: 5);

            var act = () => item.AdjustQuantity(-6);

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void Constructor_NegativeQuantity_Throws()
        {
            var act = () => new InventoryItem(1, "Soap", "amenity", -1, "bar", 10, 2m, "Supplier");

            act.Should().Throw<ArgumentException>();
        }
    }
}
