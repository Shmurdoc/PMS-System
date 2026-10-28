using System;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.Invoices;
using Aquri.Application.Payments;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests.Payments
{
    public class PaymentHandlerTestBase : IDisposable
    {
        protected readonly AquriDbContext Context;
        protected readonly ICurrentUser CurrentUser = new FakeCurrentUser();
        private readonly string _databaseName;
        protected int GuestId;

        public PaymentHandlerTestBase()
        {
            _databaseName = Guid.NewGuid().ToString();
            Context = NewContext();
            Seed().GetAwaiter().GetResult();
        }

        /// <summary>A second context over the same store, used to check what was actually committed.</summary>
        protected AquriDbContext NewContext()
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .UseInMemoryDatabase(databaseName: _databaseName)
                .Options;

            return new AquriDbContext(options);
        }

        private async Task Seed()
        {
            var guest = new Guest("Jane Doe", "jane@mail.com", "0820000000", "9001015800089", "SA");
            Context.Guests.Add(guest);
            await Context.SaveChangesAsync();
            GuestId = guest.Id;
        }

        protected async Task<int> SeedPayment(decimal amount = 500m, string method = "card", int? invoiceId = null)
        {
            var created = await new CreatePaymentHandler(Context, new NumberGenerator(Context), CurrentUser).Handle(
                new CreatePaymentCommand(1, GuestId, invoiceId, null, amount, method, "front@nexus.com"),
                CancellationToken.None);
            return created.Data!.Id;
        }

        /// <summary>An invoice whose total is exactly <paramref name="total"/> (no tax).</summary>
        protected async Task<int> SeedInvoice(decimal total = 200m)
        {
            var created = await new CreateInvoiceHandler(Context, new NumberGenerator(Context), CurrentUser).Handle(
                new CreateInvoiceCommand(1, GuestId, null, "booking", DateTime.UtcNow.AddDays(7), 0, "",
                    new List<InvoiceItemInput> { new("Room night", 1, total, 0m, "room") },
                    "front@nexus.com"),
                CancellationToken.None);

            return created.Data!.Id;
        }

        public void Dispose() => Context.Dispose();
    }

    public class CreatePaymentHandler_Should : PaymentHandlerTestBase
    {
        [Fact]
        public async Task Create_Pending_Payment()
        {
            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreatePaymentCommand(1, GuestId, null, null, 500m, "card", "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.PaymentNumber.Should().StartWith("PAY-");
            result.Data.Status.Should().Be("pending");
            result.Data.Amount.Should().Be(500m);
            result.Data.Method.Should().Be("card");
        }

        [Fact]
        public async Task Fail_On_Negative_Amount()
        {
            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreatePaymentCommand(1, GuestId, null, null, -1m, "card", "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
        }

        [Fact]
        public async Task Fail_For_Unknown_Guest()
        {
            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreatePaymentCommand(1, 999, null, null, 100m, "card", "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Guest not found");
        }

        [Fact]
        public async Task Fail_For_Unknown_Invoice()
        {
            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreatePaymentCommand(1, GuestId, 999, null, 100m, "card", "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Invoice not found");
        }

        [Fact]
        public async Task Fail_For_Unknown_Booking()
        {
            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreatePaymentCommand(1, GuestId, null, 999, 100m, "card", "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Booking not found");
        }

        [Fact]
        public async Task Fail_For_Invoice_Belonging_To_Different_Property()
        {
            var created = await new CreateInvoiceHandler(Context, new NumberGenerator(Context), CurrentUser).Handle(
                new CreateInvoiceCommand(1, GuestId, null, "booking",
                    DateTime.UtcNow.AddDays(7), 0, "",
                    new List<InvoiceItemInput> { new("Room night", 1, 100m, 0.15m, "room") },
                    "front@nexus.com"),
                CancellationToken.None);

            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreatePaymentCommand(2, GuestId, created.Data!.Id, null, 100m, "card", "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("does not belong");
        }
    }

    public class CompletePaymentHandler_Should : PaymentHandlerTestBase
    {
        [Fact]
        public async Task Complete_Pending_Payment()
        {
            var id = await SeedPayment();
            var handler = new CompletePaymentHandler(Context, CurrentUser);

            var result = await handler.Handle(new CompletePaymentCommand(id, "TXN-123"), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be("completed");
        }

        [Fact]
        public async Task Settle_The_Invoice_It_Belongs_To()
        {
            var invoiceId = await SeedInvoice(200m);
            var id = await SeedPayment(200m, invoiceId: invoiceId);

            var result = await new CompletePaymentHandler(Context, CurrentUser)
                .Handle(new CompletePaymentCommand(id, "TXN-1"), CancellationToken.None);

            result.Success.Should().BeTrue();
            var invoice = await Context.Invoices.AsNoTracking().FirstAsync(i => i.Id == invoiceId);
            invoice.PaidAmount.Should().Be(200m);
            invoice.Status.Should().Be(InvoiceStatus.Paid);
            invoice.PaidDate.Should().NotBeNull();
        }

        [Fact]
        public async Task Settle_Partially_When_The_Payment_Is_Short()
        {
            var invoiceId = await SeedInvoice(200m);
            var id = await SeedPayment(50m, invoiceId: invoiceId);

            await new CompletePaymentHandler(Context, CurrentUser)
                .Handle(new CompletePaymentCommand(id, "TXN-1"), CancellationToken.None);

            var invoice = await Context.Invoices.AsNoTracking().FirstAsync(i => i.Id == invoiceId);
            invoice.Status.Should().Be(InvoiceStatus.Partial);
            invoice.PaidAmount.Should().Be(50m);
        }

        [Fact]
        public async Task Refuse_An_Overpaying_Payment_And_Commit_Nothing()
        {
            var invoiceId = await SeedInvoice(200m);
            var id = await SeedPayment(500m, invoiceId: invoiceId);

            var result = await new CompletePaymentHandler(Context, CurrentUser)
                .Handle(new CompletePaymentCommand(id, "TXN-1"), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Conflict.Should().BeTrue();

            // A fresh context reads what was committed, not the tracked entities
            // the failed handler left behind.
            using var fresh = NewContext();
            var payment = await fresh.Payments.AsNoTracking().FirstAsync(p => p.Id == id);
            var invoice = await fresh.Invoices.AsNoTracking().FirstAsync(i => i.Id == invoiceId);
            payment.Status.Should().Be(PaymentStatus.Pending);
            invoice.PaidAmount.Should().Be(0m);
            invoice.Status.Should().Be(InvoiceStatus.Draft);
        }

        [Fact]
        public async Task Complete_Twice_Does_Not_Record_The_Money_Twice()
        {
            var invoiceId = await SeedInvoice(200m);
            var id = await SeedPayment(200m, invoiceId: invoiceId);
            var handler = new CompletePaymentHandler(Context, CurrentUser);

            await handler.Handle(new CompletePaymentCommand(id, "TXN-1"), CancellationToken.None);
            var second = await handler.Handle(new CompletePaymentCommand(id, "TXN-1"), CancellationToken.None);

            second.Success.Should().BeTrue();
            var invoice = await Context.Invoices.AsNoTracking().FirstAsync(i => i.Id == invoiceId);
            invoice.PaidAmount.Should().Be(200m);
        }

        [Fact]
        public async Task Return_NotFound_For_Unknown_Payment()
        {
            var handler = new CompletePaymentHandler(Context, CurrentUser);

            var result = await handler.Handle(new CompletePaymentCommand(999, "TXN-123"), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.NotFound.Should().BeTrue();
        }
    }

    public class RefundPaymentHandler_Should : PaymentHandlerTestBase
    {
        [Fact]
        public async Task Refund_Completed_Payment()
        {
            var id = await SeedPayment();
            await new CompletePaymentHandler(Context, CurrentUser).Handle(new CompletePaymentCommand(id, "TXN-123"), CancellationToken.None);

            var handler = new RefundPaymentHandler(Context, CurrentUser);
            var result = await handler.Handle(new RefundPaymentCommand(id), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be("refunded");
        }

        [Fact]
        public async Task Reverse_The_Invoice_It_Settled()
        {
            var invoiceId = await SeedInvoice(200m);
            var id = await SeedPayment(200m, invoiceId: invoiceId);
            await new CompletePaymentHandler(Context, CurrentUser)
                .Handle(new CompletePaymentCommand(id, "TXN-1"), CancellationToken.None);

            var result = await new RefundPaymentHandler(Context, CurrentUser)
                .Handle(new RefundPaymentCommand(id), CancellationToken.None);

            result.Success.Should().BeTrue();
            var invoice = await Context.Invoices.AsNoTracking().FirstAsync(i => i.Id == invoiceId);
            invoice.Status.Should().Be(InvoiceStatus.Refunded);
            invoice.PaidAmount.Should().Be(0m);
            invoice.PaidDate.Should().BeNull();
        }

        [Fact]
        public async Task Drop_The_Invoice_To_Partial_When_One_Of_Two_Payments_Is_Refunded()
        {
            var invoiceId = await SeedInvoice(200m);
            var first = await SeedPayment(100m, invoiceId: invoiceId);
            var second = await SeedPayment(100m, invoiceId: invoiceId);
            await new CompletePaymentHandler(Context, CurrentUser)
                .Handle(new CompletePaymentCommand(first, "TXN-1"), CancellationToken.None);
            await new CompletePaymentHandler(Context, CurrentUser)
                .Handle(new CompletePaymentCommand(second, "TXN-2"), CancellationToken.None);

            await new RefundPaymentHandler(Context, CurrentUser)
                .Handle(new RefundPaymentCommand(second), CancellationToken.None);

            var invoice = await Context.Invoices.AsNoTracking().FirstAsync(i => i.Id == invoiceId);
            invoice.Status.Should().Be(InvoiceStatus.Partial);
            invoice.PaidAmount.Should().Be(100m);
            invoice.PaidDate.Should().BeNull();
        }

        [Fact]
        public async Task Refund_Twice_Does_Not_Reverse_The_Money_Twice()
        {
            var invoiceId = await SeedInvoice(200m);
            var id = await SeedPayment(100m, invoiceId: invoiceId);
            await new CompletePaymentHandler(Context, CurrentUser)
                .Handle(new CompletePaymentCommand(id, "TXN-1"), CancellationToken.None);
            var handler = new RefundPaymentHandler(Context, CurrentUser);

            await handler.Handle(new RefundPaymentCommand(id), CancellationToken.None);
            var second = await handler.Handle(new RefundPaymentCommand(id), CancellationToken.None);

            second.Success.Should().BeTrue();
            var invoice = await Context.Invoices.AsNoTracking().FirstAsync(i => i.Id == invoiceId);
            invoice.PaidAmount.Should().Be(0m);
            invoice.Status.Should().Be(InvoiceStatus.Refunded);
        }

        [Fact]
        public async Task Reject_Refunding_Pending_Payment()
        {
            var id = await SeedPayment();
            var handler = new RefundPaymentHandler(Context, CurrentUser);

            var result = await handler.Handle(new RefundPaymentCommand(id), CancellationToken.None);

            result.Success.Should().BeFalse();
        }
    }

    public class GetPaymentsHandler_Should : PaymentHandlerTestBase
    {
        [Fact]
        public async Task Filter_By_Property_And_Status()
        {
            await SeedPayment();

            var handler = new GetPaymentsHandler(Context);

            var pending = await handler.Handle(new GetPaymentsQuery(1, "pending"), CancellationToken.None);
            var other = await handler.Handle(new GetPaymentsQuery(1, "refunded"), CancellationToken.None);

            pending.Should().HaveCount(1);
            other.Should().BeEmpty();
        }
    }

    sealed class FakeCurrentUser : ICurrentUser
    {
        public bool IsAuthenticated => true;
        public int? PropertyId => 1;
        public int UserId => 1;
        public string UserName => "test-user";
        public string UserRole => "admin";
    }
}
