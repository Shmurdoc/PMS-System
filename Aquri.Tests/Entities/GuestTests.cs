using Aquri.Domain.Entities;
using Aquri.Domain.Exceptions;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class GuestTests
    {
        private static Guest NewGuest() =>
            new("Thabo Mokoena", "thabo@example.com", "+27821234567", "ZA123456", "South African");

        [Fact]
        public void Constructor_ValidData_CreatesGuest()
        {
            var guest = NewGuest();

            guest.Name.Should().Be("Thabo Mokoena");
            guest.Segment.Should().Be("New");
            guest.LoyaltyPoints.Should().Be(0);
            guest.Created.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Constructor_EmptyName_Throws(string name)
        {
            var act = () => new Guest(name, "a@b.com", "123", "ID", "SA");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void RecordStay_IncrementsStaysAndPoints()
        {
            var guest = NewGuest();

            guest.RecordStay(50);
            guest.RecordStay(30);

            guest.TotalStays.Should().Be(2);
            guest.LoyaltyPoints.Should().Be(80);
        }

        [Fact]
        public void RecordStay_NegativePoints_Throws()
        {
            var guest = NewGuest();

            var act = () => guest.RecordStay(-5);

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void SpendLoyaltyPoints_BeyondBalance_Throws()
        {
            var guest = NewGuest();
            guest.RecordStay(10);

            var act = () => guest.SpendLoyaltyPoints(11);

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void ChangeSegment_Invalid_Throws()
        {
            var guest = NewGuest();

            var act = () => guest.ChangeSegment("tourist");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void SetVipLevel_Valid_Sets()
        {
            var guest = NewGuest();

            guest.SetVipLevel("gold");

            guest.VipLevel.Should().Be("gold");
        }
    }
}
