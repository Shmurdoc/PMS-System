using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class BookingTests
    {
        private static Booking NewBooking(decimal rate = 1500m) =>
            new(1, 1, 1, new DateTime(2026, 11, 1), new DateTime(2026, 11, 4), 2, rate, "direct");

        [Fact]
        public void Constructor_ComputesNightsAndAmount()
        {
            var booking = NewBooking(1500m);

            booking.Nights.Should().Be(3);
            booking.Amount.Should().Be(4500m);
            booking.Status.Should().Be(BookingStatus.Pending);
            booking.PaymentStatus.Should().Be(BookingPaymentStatus.Pending);
        }

        [Fact]
        public void Constructor_CheckOutBeforeCheckIn_Throws()
        {
            var act = () => new Booking(1, 1, 1, new DateTime(2026, 11, 4), new DateTime(2026, 11, 1), 2, 100m, "direct");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void ChangeStatus_PendingToConfirmed_Succeeds()
        {
            var booking = NewBooking();

            booking.ChangeStatus(BookingStatus.Confirmed);

            booking.Status.Should().Be(BookingStatus.Confirmed);
        }

        [Fact]
        public void ChangeStatus_CheckedOutToCheckedIn_Throws()
        {
            var booking = NewBooking();
            booking.ChangeStatus(BookingStatus.Confirmed);
            booking.ChangeStatus(BookingStatus.CheckedIn);
            booking.ChangeStatus(BookingStatus.CheckedOut);

            var act = () => booking.ChangeStatus(BookingStatus.CheckedIn);

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void RecordDeposit_ExceedingTotal_Throws()
        {
            // NewBooking(1000m) = 3 nights → R3000 total.
            var booking = NewBooking(1000m);

            var act = () => booking.RecordDeposit(3500m);

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void RecordDeposit_PartialThenFull_UpdatesPaymentStatus()
        {
            // NewBooking(1000m) = 3 nights → R3000 total.
            var booking = NewBooking(1000m);

            booking.RecordDeposit(1500m);
            booking.PaymentStatus.Should().Be(BookingPaymentStatus.Partial);

            booking.RecordDeposit(1500m);
            booking.PaymentStatus.Should().Be(BookingPaymentStatus.Paid);
            booking.DepositPaid.Should().Be(3000m);
        }

        [Fact]
        public void CanTransitionTo_ValidPath_True()
        {
            Booking.CanTransitionTo(BookingStatus.Pending, BookingStatus.Confirmed).Should().BeTrue();
            Booking.CanTransitionTo(BookingStatus.Confirmed, BookingStatus.CheckedIn).Should().BeTrue();
            Booking.CanTransitionTo(BookingStatus.CheckedIn, BookingStatus.CheckedOut).Should().BeTrue();
        }

        [Fact]
        public void CanTransitionTo_InvalidPath_False()
        {
            Booking.CanTransitionTo(BookingStatus.Pending, BookingStatus.CheckedOut).Should().BeFalse();
            Booking.CanTransitionTo(BookingStatus.Cancelled, BookingStatus.Confirmed).Should().BeFalse();
        }
    }
}
