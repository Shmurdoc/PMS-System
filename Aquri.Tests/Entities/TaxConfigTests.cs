using Aquri.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class TaxConfigTests
    {
        private static DateTime Jan => new(2026, 1, 1);

        private static TaxConfig NewVat() =>
            new(1, "VAT", 0.15m, "vat", Jan);

        [Fact]
        public void Constructor_Valid()
        {
            var tax = NewVat();

            tax.Rate.Should().Be(0.15m);
            tax.Type.Should().Be("vat");
            tax.Active.Should().BeTrue();
        }

        [Fact]
        public void Constructor_RateAboveOne_Throws()
        {
            var act = () => new TaxConfig(1, "Bad", 15m, "vat", Jan);

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void AppliesOn_WithinWindow_True()
        {
            var tax = NewVat();

            tax.AppliesOn(new DateTime(2026, 6, 1)).Should().BeTrue();
        }

        [Fact]
        public void AppliesOn_AfterEnd_False()
        {
            var tax = NewVat();
            tax.End(new DateTime(2026, 12, 31));

            tax.AppliesOn(new DateTime(2027, 1, 1)).Should().BeFalse();
        }

        [Fact]
        public void AppliesOn_Deactivated_False()
        {
            var tax = NewVat();
            tax.Deactivate();

            tax.AppliesOn(new DateTime(2026, 6, 1)).Should().BeFalse();
        }

        [Fact]
        public void End_BeforeValidFrom_Throws()
        {
            var tax = NewVat();

            var act = () => tax.End(new DateTime(2025, 1, 1));

            act.Should().Throw<ArgumentException>();
        }
    }
}
