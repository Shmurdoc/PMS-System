using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class InvoiceTests
    {
        private static Invoice NewInvoice() =>
            new("INV-2026-00001", 1, 1, DateTime.UtcNow.AddDays(14), "front@nexus.com");

        private static InvoiceItem RoomLine(decimal unitPrice = 1500m, int qty = 3) =>
            new("Room night", qty, unitPrice, 0.15m, "room");

        [Fact]
        public void Constructor_SetsDraftStatus()
        {
            var invoice = NewInvoice();

            invoice.InvoiceNumber.Should().Be("INV-2026-00001");
            invoice.Status.Should().Be(InvoiceStatus.Draft);
            invoice.Currency.Should().Be("ZAR");
        }

        [Fact]
        public void AddItem_RecalculatesTotals()
        {
            var invoice = NewInvoice();

            invoice.AddItem(RoomLine(1000m, 2));

            invoice.Subtotal.Should().Be(2000m);
            invoice.TaxAmount.Should().Be(300m);
            invoice.Total.Should().Be(2300m);
        }

        [Fact]
        public void ApplyDiscount_RecomputesTotal()
        {
            var invoice = NewInvoice();
            invoice.AddItem(RoomLine(1000m, 2));

            invoice.ApplyDiscount(200m);

            invoice.Total.Should().Be(2100m);
        }

        [Fact]
        public void RemoveItem_DropsFromTotals()
        {
            var invoice = NewInvoice();
            var first = RoomLine(1000m, 1);
            invoice.AddItem(first);
            invoice.AddItem(RoomLine(500m, 1));

            // In-memory items share Id == 0, so this removes the first line added.
            invoice.RemoveItem(first.Id);

            invoice.Items.Should().HaveCount(1);
            invoice.Subtotal.Should().Be(500m);
        }

        [Fact]
        public void RecordPayment_UnderTotal_MarksPartial()
        {
            var invoice = NewInvoice();
            invoice.AddItem(RoomLine(1000m, 2)); // total 2300

            invoice.RecordPayment(1000m, "card");

            invoice.Status.Should().Be(InvoiceStatus.Partial);
            invoice.PaidAmount.Should().Be(1000m);
            invoice.PaidDate.Should().BeNull();
        }

        [Fact]
        public void RecordPayment_SpansTotal_MarksPaid()
        {
            var invoice = NewInvoice();
            invoice.AddItem(RoomLine(1000m, 2)); // total 2300

            invoice.RecordPayment(2300m, "card");

            invoice.Status.Should().Be(InvoiceStatus.Paid);
            invoice.PaidDate.Should().NotBeNull();
        }

        [Fact]
        public void ReversePayment_Partial_KeepsPartialAndClearsThePaidDate()
        {
            var invoice = NewInvoice();
            invoice.AddItem(RoomLine(1000m, 2)); // total 2300
            invoice.RecordPayment(2300m, "card");

            invoice.ReversePayment(300m);

            invoice.Status.Should().Be(InvoiceStatus.Partial);
            invoice.PaidAmount.Should().Be(2000m);
            invoice.PaidDate.Should().BeNull();
        }

        [Fact]
        public void ReversePayment_Full_MarksRefunded()
        {
            var invoice = NewInvoice();
            invoice.AddItem(RoomLine(1000m, 2));
            invoice.RecordPayment(2300m, "card");

            invoice.ReversePayment(2300m);

            invoice.Status.Should().Be(InvoiceStatus.Refunded);
            invoice.PaidAmount.Should().Be(0m);
            invoice.PaidDate.Should().BeNull();
        }

        [Fact]
        public void ReversePayment_MoreThanWasPaid_Throws()
        {
            var invoice = NewInvoice();
            invoice.AddItem(RoomLine(1000m, 2));
            invoice.RecordPayment(500m, "card");

            var act = () => invoice.ReversePayment(600m);

            act.Should().Throw<DomainException>().WithMessage("*Cannot reverse*");
            invoice.PaidAmount.Should().Be(500m);
        }

        [Fact]
        public void ReversePayment_NonPositive_Throws()
        {
            var invoice = NewInvoice();
            invoice.AddItem(RoomLine(1000m, 2));
            invoice.RecordPayment(500m, "card");

            var act = () => invoice.ReversePayment(0m);

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void ChangeStatus_IllegalTransition_Throws()
        {
            var invoice = NewInvoice();

            // Draft cannot jump straight to Paid — the transition map forbids it.
            var act = () => invoice.ChangeStatus(InvoiceStatus.Paid);

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void InvoiceItem_AmountIsQuantityTimesUnitPrice()
        {
            var item = new ItemProbe("Minibar", 3, 45.50m, 0.15m, "food_beverage");

            item.ExposedAmount.Should().Be(136.50m);
        }

        [Fact]
        public void InvoiceItem_UpdateQuantity_UpdatesAmount()
        {
            var item = new ItemProbe("Minibar", 1, 45m, 0.15m, "food_beverage");

            item.UpdateQuantity(4);

            item.ExposedAmount.Should().Be(180m);
        }

        [Fact]
        public void InvoiceItem_NegativeTaxRate_Throws()
        {
            var act = () => new InvoiceItem("Spa", 1, 100m, -0.01m, "spa");

            act.Should().Throw<ArgumentException>();
        }

        /// <summary>InvoiceItem.Amount is derived, so a tiny probe exposes it for assertions.</summary>
        private class ItemProbe : InvoiceItem
        {
            public ItemProbe(string description, int quantity, decimal unitPrice, decimal taxRate, string category)
                : base(description, quantity, unitPrice, taxRate, category)
            {
            }

            public decimal ExposedAmount => Amount;
        }
    }
}
