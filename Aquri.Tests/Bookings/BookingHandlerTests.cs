using System;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Bookings;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Aquri.Tests.Common;

namespace Aquri.Tests.Bookings
{
    public class BookingHandlerTestBase : IDisposable
    {
        protected readonly AquriDbContext Context;
        protected readonly ICurrentUser CurrentUser = new FakeCurrentUser();
        protected int RoomId;
        protected int GuestId;

        public BookingHandlerTestBase()
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory, Aquri.Infrastructure.Persistence.PropertyScopeModelCacheKeyFactory>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            Context = new AquriDbContext(options);
            Seed().GetAwaiter().GetResult();
        }

        private async Task Seed()
        {
            var guest = new Guest("Jane Doe", "jane@mail.com", "0820000000", "9001015800089", "SA");
            Context.Guests.Add(guest);

            var room = new Room("101", 1, "double");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            GuestId = guest.Id;
            RoomId = room.Id;
        }

        public void Dispose() => Context.Dispose();
    }

    public class CreateBookingHandler_Should : BookingHandlerTestBase
    {
        [Fact]
        public async Task Create_Booking_And_Mark_Room_Occupied()
        {
            var handler = new CreateBookingHandler(Context, CurrentUser);
            var command = new CreateBookingCommand(1, GuestId, RoomId,
                DateTime.UtcNow.Date.AddDays(1), DateTime.UtcNow.Date.AddDays(3), 2, 199.99m, "direct");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be("pending");
            result.Data.Amount.Should().Be(399.98m);
            result.Data.Nights.Should().Be(2);

            var room = await Context.Rooms.FindAsync(RoomId);
            room!.Status.Should().Be(RoomStatus.Occupied);
        }

        [Fact]
        public async Task Reject_Overlapping_Booking()
        {
            var handler = new CreateBookingHandler(Context, CurrentUser);
            var checkIn = DateTime.UtcNow.Date.AddDays(1);
            var checkOut = DateTime.UtcNow.Date.AddDays(3);

            await handler.Handle(new CreateBookingCommand(1, GuestId, RoomId, checkIn, checkOut, 2, 199.99m, "direct"), CancellationToken.None);
            var second = await handler.Handle(new CreateBookingCommand(1, GuestId, RoomId, checkIn, checkOut, 2, 199.99m, "web"), CancellationToken.None);

            second.Success.Should().BeFalse();
            second.Error.Should().Contain("not available");
        }

        [Fact]
        public async Task Fail_For_Unknown_Room()
        {
            var handler = new CreateBookingHandler(Context, CurrentUser);
            var command = new CreateBookingCommand(1, GuestId, 999,
                DateTime.UtcNow.Date.AddDays(1), DateTime.UtcNow.Date.AddDays(2), 1, 100m, "direct");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Room not found");
        }

        [Fact]
        public async Task Reject_Booking_When_Room_Belongs_To_Different_Property()
        {
            var handler = new CreateBookingHandler(Context, CurrentUser);
            // RoomId is seeded under PropertyId 1 — stamping the booking onto
            // PropertyId 2 must be rejected, not silently persisted.
            var command = new CreateBookingCommand(2, GuestId, RoomId,
                DateTime.UtcNow.Date.AddDays(1), DateTime.UtcNow.Date.AddDays(2), 1, 100m, "direct");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("does not belong");
        }
    }

    public class ChangeBookingStatusHandler_Should : BookingHandlerTestBase
    {
        private async Task<int> SeedBooking()
        {
            var created = await new CreateBookingHandler(Context, CurrentUser).Handle(
                new CreateBookingCommand(1, GuestId, RoomId,
                    DateTime.UtcNow.Date.AddDays(1), DateTime.UtcNow.Date.AddDays(3), 2, 199.99m, "direct"),
                CancellationToken.None);
            return created.Data!.Id;
        }

        [Fact]
        public async Task Transition_Pending_To_Confirmed()
        {
            var id = await SeedBooking();
            var handler = new ChangeBookingStatusHandler(Context);

            var result = await handler.Handle(new ChangeBookingStatusCommand(id, "confirmed"), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be("confirmed");
        }

        [Fact]
        public async Task Reject_Illegal_Transition()
        {
            var id = await SeedBooking();
            var handler = new ChangeBookingStatusHandler(Context);

            var result = await handler.Handle(new ChangeBookingStatusCommand(id, "checked-out"), CancellationToken.None);

            result.Success.Should().BeFalse();
        }

        [Fact]
        public async Task Return_NotFound_For_Unknown_Booking()
        {
            var handler = new ChangeBookingStatusHandler(Context);

            var result = await handler.Handle(new ChangeBookingStatusCommand(999, "confirmed"), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.NotFound.Should().BeTrue();
        }
    }

    public class GetBookingsHandler_Should : BookingHandlerTestBase
    {
        [Fact]
        public async Task Filter_By_Property_And_Status()
        {
            await new CreateBookingHandler(Context, CurrentUser).Handle(
                new CreateBookingCommand(1, GuestId, RoomId,
                    DateTime.UtcNow.Date.AddDays(1), DateTime.UtcNow.Date.AddDays(3), 2, 199.99m, "direct"),
                CancellationToken.None);

            var handler = new GetBookingsHandler(Context, CurrentUser);

            var all = await handler.Handle(new GetBookingsQuery(1, null), CancellationToken.None);
            var none = await handler.Handle(new GetBookingsQuery(2, null), CancellationToken.None);

            all.Data.Should().HaveCount(1);
            none.Data.Should().BeEmpty();
        }
    }
}
