using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Invoices;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests.Invoices
{
    public class InvoiceHandlerTestBase : IDisposable
    {
        protected readonly AquriDbContext Context;
        protected int GuestId;

        public InvoiceHandlerTestBase()
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

        protected async Task<int> SeedInvoice(string type = "booking")
        {
            var created = await new CreateInvoiceHandler(Context, new NumberGenerator(Context)).Handle(
                new CreateInvoiceCommand(1, GuestId, null, type, DateTime.UtcNow.AddDays(7),
                    0, "Notes", new List<InvoiceItemInput>
                    {
                        new("Room night", 2, 199.99m, 0.15m, "room")
                    }, "front@nexus.com"),
                CancellationToken.None);
            return created.Data!.Id;
        }

        public void Dispose() => Context.Dispose();
    }

    public class CreateInvoiceHandler_Should : InvoiceHandlerTestBase
    {
        [Fact]
        public async Task Create_Invoice_With_Computed_Total()
        {
            var handler = new CreateInvoiceHandler(Context, new NumberGenerator(Context));
            var command = new CreateInvoiceCommand(1, GuestId, null, "booking", DateTime.UtcNow.AddDays(7),
                0, "", new List<InvoiceItemInput> { new("Room night", 2, 199.99m, 0.15m, "room") }, "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.InvoiceNumber.Should().StartWith("INV-");
            result.Data.Subtotal.Should().Be(399.98m);
            result.Data.TaxAmount.Should().Be(59.997m);
            result.Data.Total.Should().Be(459.977m);
            result.Data.Items.Should().HaveCount(1);
        }

        [Fact]
        public async Task Fail_Without_Line_Items()
        {
            var handler = new CreateInvoiceHandler(Context, new NumberGenerator(Context));
            var command = new CreateInvoiceCommand(1, GuestId, null, "booking", DateTime.UtcNow.AddDays(7),
                0, "", new List<InvoiceItemInput>(), "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("line item");
        }

        [Fact]
        public async Task Fail_For_Unknown_Guest()
        {
            var handler = new CreateInvoiceHandler(Context, new NumberGenerator(Context));
            var command = new CreateInvoiceCommand(1, 999, null, "booking", DateTime.UtcNow.AddDays(7),
                0, "", new List<InvoiceItemInput> { new("Room night", 1, 100m, 0.15m, "room") }, "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Guest not found");
        }
    }

    public class RecordInvoicePaymentHandler_Should : InvoiceHandlerTestBase
    {
        [Fact]
        public async Task Mark_Paid_When_Fully_Settled()
        {
            var id = await SeedInvoice();
            var handler = new RecordInvoicePaymentHandler(Context);

            var result = await handler.Handle(new RecordInvoicePaymentCommand(id, 459.977m, "card"), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be("paid");
            result.Data.PaidAmount.Should().Be(459.977m);
        }

        [Fact]
        public async Task Mark_Partial_When_Underpaid()
        {
            var id = await SeedInvoice();
            var handler = new RecordInvoicePaymentHandler(Context);

            var result = await handler.Handle(new RecordInvoicePaymentCommand(id, 100m, "card"), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be("partial");
        }

        [Fact]
        public async Task Reject_NonPositive_Amount()
        {
            var id = await SeedInvoice();
            var handler = new RecordInvoicePaymentHandler(Context);

            var result = await handler.Handle(new RecordInvoicePaymentCommand(id, 0m, "card"), CancellationToken.None);

            result.Success.Should().BeFalse();
        }
    }

    public class GetInvoiceHandler_Should : InvoiceHandlerTestBase
    {
        [Fact]
        public async Task Return_NotFound_For_Unknown_Invoice()
        {
            var handler = new GetInvoiceHandler(Context);

            var result = await handler.Handle(new GetInvoiceQuery(999), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.NotFound.Should().BeTrue();
        }

        [Fact]
        public async Task Filter_By_Status()
        {
            await SeedInvoice();

            var handler = new GetInvoicesHandler(Context);

            var draft = await handler.Handle(new GetInvoicesQuery(1, "draft"), CancellationToken.None);
            var paid = await handler.Handle(new GetInvoicesQuery(1, "paid"), CancellationToken.None);

            draft.Should().HaveCount(1);
            paid.Should().BeEmpty();
        }
    }
}
