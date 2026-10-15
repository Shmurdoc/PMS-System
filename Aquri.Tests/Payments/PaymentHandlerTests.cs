using System;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Invoices;
using Aquri.Application.Payments;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests.Payments
{
    public class PaymentHandlerTestBase : IDisposable
    {
        protected readonly AquriDbContext Context;
        protected int GuestId;

        public PaymentHandlerTestBase()
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            Context = new AquriDbContext(options);
            Seed().GetAwaiter().GetResult();
        }

        private async Task Seed()
        {
            var guest = new Guest("Jane Doe", "jane@mail.com", "0820000000", "9001015800089", "SA");
            Context.Guests.Add(guest);
            await Context.SaveChangesAsync();
            GuestId = guest.Id;
        }

        protected async Task<int> SeedPayment(decimal amount = 500m, string method = "card")
        {
            var created = await new CreatePaymentHandler(Context, new NumberGenerator(Context)).Handle(
                new CreatePaymentCommand(1, GuestId, null, null, amount, method, "front@nexus.com"),
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
            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context));
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
            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context));
            var command = new CreatePaymentCommand(1, GuestId, null, null, -1m, "card", "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
        }

        [Fact]
        public async Task Fail_For_Unknown_Guest()
        {
            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context));
            var command = new CreatePaymentCommand(1, 999, null, null, 100m, "card", "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Guest not found");
        }

        [Fact]
        public async Task Fail_For_Unknown_Invoice()
        {
            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context));
            var command = new CreatePaymentCommand(1, GuestId, 999, null, 100m, "card", "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Invoice not found");
        }

        [Fact]
        public async Task Fail_For_Unknown_Booking()
        {
            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context));
            var command = new CreatePaymentCommand(1, GuestId, null, 999, 100m, "card", "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Booking not found");
        }

        [Fact]
        public async Task Fail_For_Invoice_Belonging_To_Different_Property()
        {
            var created = await new CreateInvoiceHandler(Context, new NumberGenerator(Context)).Handle(
                new CreateInvoiceCommand(1, GuestId, null, "booking",
                    DateTime.UtcNow.AddDays(7), 0, "",
                    new List<InvoiceItemInput> { new("Room night", 1, 100m, 0.15m, "room") },
                    "front@nexus.com"),
                CancellationToken.None);

            var handler = new CreatePaymentHandler(Context, new NumberGenerator(Context));
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
            var handler = new CompletePaymentHandler(Context);

            var result = await handler.Handle(new CompletePaymentCommand(id, "TXN-123"), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be("completed");
        }

        [Fact]
        public async Task Return_NotFound_For_Unknown_Payment()
        {
            var handler = new CompletePaymentHandler(Context);

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
            await new CompletePaymentHandler(Context).Handle(new CompletePaymentCommand(id, "TXN-123"), CancellationToken.None);

            var handler = new RefundPaymentHandler(Context);
            var result = await handler.Handle(new RefundPaymentCommand(id), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be("refunded");
        }

        [Fact]
        public async Task Reject_Refunding_Pending_Payment()
        {
            var id = await SeedPayment();
            var handler = new RefundPaymentHandler(Context);

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
}
