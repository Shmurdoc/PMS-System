using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class PaymentTests
    {
        private static Payment NewPayment(string method = "card") =>
            new("PAY-2026-00001", 1, 1, 500m, method, "front@nexus.com");

        [Fact]
        public void Constructor_Valid_PendingStatus()
        {
            var payment = NewPayment();

            payment.Status.Should().Be(PaymentStatus.Pending);
            payment.Method.Should().Be("card");
            payment.ProcessedBy.Should().Be("front@nexus.com");
        }

        [Fact]
        public void Constructor_UnknownMethod_Throws()
        {
            var act = () => NewPayment("bitcoin");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void Constructor_NonPositiveAmount_Throws()
        {
            var act = () => new Payment("PAY-1", 1, 1, 0m, "cash", "front@nexus.com");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void Complete_FromPending_StampsProcessedAt()
        {
            var payment = NewPayment();

            payment.Complete("TXN-99");

            payment.Status.Should().Be(PaymentStatus.Completed);
            payment.TransactionId.Should().Be("TXN-99");
            payment.ProcessedAt.Should().NotBeNull();
        }

        [Fact]
        public void Complete_FromRefunded_Throws()
        {
            var payment = NewPayment();
            payment.Complete(null);
            payment.Refund();

            var act = () => payment.Complete(null);

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void Refund_OnlyAfterCompleted()
        {
            var payment = NewPayment();

            var act = () => payment.Refund();

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void Cancel_AfterCompleted_Throws()
        {
            var payment = NewPayment();
            payment.Complete(null);

            var act = () => payment.Cancel();

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void Lifecycle_HappyPath_PendingToProcessingToCompleted()
        {
            var payment = NewPayment();

            payment.MarkProcessing();
            payment.Complete("TXN-1");

            payment.Status.Should().Be(PaymentStatus.Completed);
        }
    }
}
