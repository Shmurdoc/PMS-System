using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Bookings;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.Invoices;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Aquri.Tests.Common;

namespace Aquri.Tests.Invoices
{
    public class InvoiceHandlerTestBase : IDisposable
    {
        protected readonly AquriDbContext Context;
        protected readonly ICurrentUser CurrentUser = new FakeCurrentUser();
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
            // A property row is needed: CreateInvoiceHandler inherits the
            // property's currency.
            Context.Properties.Add(new Property("Test HQ", 1));
            var guest = new Guest("Jane Doe", "jane@mail.com", "0820000000", "9001015800089", "SA");
            Context.Guests.Add(guest);
            await Context.SaveChangesAsync();
            GuestId = guest.Id;
        }

        protected async Task<int> SeedInvoice(string type = "booking")
        {
            var created = await new CreateInvoiceHandler(Context, new NumberGenerator(Context), CurrentUser).Handle(
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
            var handler = new CreateInvoiceHandler(Context, new NumberGenerator(Context), CurrentUser);
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
            var handler = new CreateInvoiceHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreateInvoiceCommand(1, GuestId, null, "booking", DateTime.UtcNow.AddDays(7),
                0, "", new List<InvoiceItemInput>(), "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("line item");
        }

        [Fact]
        public async Task Fail_For_Unknown_Guest()
        {
            var handler = new CreateInvoiceHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreateInvoiceCommand(1, 999, null, "booking", DateTime.UtcNow.AddDays(7),
                0, "", new List<InvoiceItemInput> { new("Room night", 1, 100m, 0.15m, "room") }, "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Guest not found");
        }

        [Fact]
        public async Task Override_Client_Tax_Rate_With_Server_Configured_Rule()
        {
            // Property 1 has a 14% VAT rule on file — the client-sent 15% must lose.
            Context.TaxConfigs.Add(new TaxConfig(1, "VAT", 0.14m, "vat", DateTime.UtcNow.AddDays(-1)));
            await Context.SaveChangesAsync();

            var handler = new CreateInvoiceHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreateInvoiceCommand(1, GuestId, null, "booking", DateTime.UtcNow.AddDays(7),
                0, "", new List<InvoiceItemInput> { new("Room night", 2, 199.99m, 0.15m, "room") }, "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.TaxAmount.Should().Be(399.98m * 0.14m);
        }

        [Fact]
        public async Task Ignore_Service_Charge_Rules_When_Resolving_Tax()
        {
            // Service charges are fees, not taxes — must not replace the client rate.
            Context.TaxConfigs.Add(new TaxConfig(1, "Breakfast service", 0.10m, "service_charge", DateTime.UtcNow.AddDays(-1)));
            await Context.SaveChangesAsync();

            var handler = new CreateInvoiceHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreateInvoiceCommand(1, GuestId, null, "booking", DateTime.UtcNow.AddDays(7),
                0, "", new List<InvoiceItemInput> { new("Room night", 2, 199.99m, 0.15m, "room") }, "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.TaxAmount.Should().Be(399.98m * 0.15m);
        }

        [Fact]
        public async Task Fail_For_Unknown_Booking()
        {
            var handler = new CreateInvoiceHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreateInvoiceCommand(1, GuestId, 999, "booking", DateTime.UtcNow.AddDays(7),
                0, "", new List<InvoiceItemInput> { new("Room night", 1, 100m, 0.15m, "room") }, "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Booking not found");
        }

        [Fact]
        public async Task Fail_For_Booking_Belonging_To_Different_Property()
        {
            var room = new Room("102", 1, "double");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();
            var booking = await new CreateBookingHandler(Context, CurrentUser).Handle(
                new CreateBookingCommand(1, GuestId, room.Id,
                    DateTime.UtcNow.Date.AddDays(1), DateTime.UtcNow.Date.AddDays(2), 1, 100m, "direct"),
                CancellationToken.None);

            var handler = new CreateInvoiceHandler(Context, new NumberGenerator(Context), CurrentUser);
            var command = new CreateInvoiceCommand(2, GuestId, booking.Data!.Id, "booking", DateTime.UtcNow.AddDays(7),
                0, "", new List<InvoiceItemInput> { new("Room night", 1, 100m, 0.15m, "room") }, "front@nexus.com");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("does not belong");
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

            var handler = new GetInvoicesHandler(Context, CurrentUser);

            var draft = await handler.Handle(new GetInvoicesQuery(1, "draft"), CancellationToken.None);
            var paid = await handler.Handle(new GetInvoicesQuery(1, "paid"), CancellationToken.None);

            draft.Data.Should().HaveCount(1);
            paid.Data.Should().BeEmpty();
        }
    }
}
