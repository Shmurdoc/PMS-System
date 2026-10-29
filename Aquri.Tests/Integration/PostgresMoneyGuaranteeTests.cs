using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Bookings;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.Payments;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using Aquri.Tests.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Xunit.Abstractions;

namespace Aquri.Tests.Integration;

/// <summary>
/// Proves the money-safety guarantees against a real PostgreSQL database.
/// The EF InMemory provider ignores filtered indexes and exclusion
/// constraints, so the idempotency and double-booking defenses can only be
/// verified here. These tests run in CI against a postgres service container;
/// locally they use the Aquri database on localhost:5432.
/// </summary>
[Collection("postgres")]
public sealed class PostgresMoneyGuaranteeTests
{
    private readonly PostgresTestDatabase _db;
    private readonly ITestOutputHelper _output;

    public PostgresMoneyGuaranteeTests(PostgresTestDatabase db, ITestOutputHelper output)
    {
        _db = db;
        _output = output;
    }

    private (bool ready, AquriDbContext ctx) Ready()
    {
        if (!_db.Available)
        {
            _output.WriteLine("SKIPPED: PostgreSQL not reachable.");
            return (false, null!);
        }
        _db.ClearTables();
        return (true, _db.NewContext());
    }

    private static async Task<Property> SeedPropertyAsync(AquriDbContext ctx, int tenantId)
    {
        var property = new Property("Integration HQ", tenantId);
        ctx.Properties.Add(property);
        await ctx.SaveChangesAsync();
        return property;
    }

    private static async Task<Guest> SeedGuestAsync(AquriDbContext ctx, string email)
    {
        var guest = new Guest("Money Guest", email, "+27123", "8502025800082", "South African");
        guest.AssignProperty(1);
        ctx.Guests.Add(guest);
        await ctx.SaveChangesAsync();
        return guest;
    }

    private static async Task<Room> SeedRoomAsync(AquriDbContext ctx, int tenantId, string number)
    {
        var room = new Room(number, tenantId, "double");
        ctx.Rooms.Add(room);
        await ctx.SaveChangesAsync();
        return room;
    }

    [Fact]
    public async Task Booking_Overlap_Is_Rejected_By_Postgres()
    {
        var (ready, ctx) = Ready();
        if (!ready)
            return;

        var user = new FakeCurrentUser();
        var property = await SeedPropertyAsync(ctx, 1);
        var room = await SeedRoomAsync(ctx, 1, "p901");
        var guest = await SeedGuestAsync(ctx, "pg.overlap@nexus.com");

        var handler = new CreateBookingHandler(ctx, user);

        var first = await handler.Handle(new CreateBookingCommand(1, guest.Id, room.Id,
            new DateTime(2026, 12, 10, 14, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 14, 11, 0, 0, DateTimeKind.Utc), 1, 750m, "direct"), CancellationToken.None);
        first.Success.Should().BeTrue("the first booking must succeed against Postgres");

        var overlap = await handler.Handle(new CreateBookingCommand(1, guest.Id, room.Id,
            new DateTime(2026, 12, 11, 10, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 13, 10, 0, 0, DateTimeKind.Utc), 1, 750m, "direct"), CancellationToken.None);

        overlap.Conflict.Should().BeTrue(
            "the exclusion constraint (CK_Bookings_NoOverlap) must fire and map to a 409");
        (await ctx.Bookings.CountAsync()).Should().Be(1);
        _output.WriteLine($"{property.Name}: overlap correctly rejected.");
    }

    [Fact]
    public async Task Booking_BackToBack_Is_Allowed_By_Postgres()
    {
        var (ready, ctx) = Ready();
        if (!ready)
            return;

        var user = new FakeCurrentUser();
        await SeedPropertyAsync(ctx, 1);
        var room = await SeedRoomAsync(ctx, 1, "p902");
        var guest = await SeedGuestAsync(ctx, "pg.backtoback@nexus.com");

        var handler = new CreateBookingHandler(ctx, user);

        var first = await handler.Handle(new CreateBookingCommand(1, guest.Id, room.Id,
            new DateTime(2026, 12, 20, 14, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 22, 11, 0, 0, DateTimeKind.Utc), 1, 750m, "direct"), CancellationToken.None);
        first.Success.Should().BeTrue();

        // Check-out of the first equals check-in of the second: the '[)' range
        // excludes the upper bound, so back-to-back stays legal.
        var contiguous = await handler.Handle(new CreateBookingCommand(1, guest.Id, room.Id,
            new DateTime(2026, 12, 22, 11, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 24, 11, 0, 0, DateTimeKind.Utc), 1, 750m, "direct"), CancellationToken.None);

        contiguous.Success.Should().BeTrue("back-to-back stays are allowed by the '[)' range");
        (await ctx.Bookings.CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task Payment_Same_Idempotency_Key_Creates_One_Row_On_Postgres()
    {
        var (ready, ctx) = Ready();
        if (!ready)
            return;

        var user = new FakeCurrentUser();
        await SeedPropertyAsync(ctx, 1);
        var guest = await SeedGuestAsync(ctx, "pg.idem@nexus.com");

        var handler = new CreatePaymentHandler(ctx, new NumberGenerator(ctx), user);
        var key = "pg-idem-1";

        var create1 = await handler.Handle(new CreatePaymentCommand(1, guest.Id, null, null, 500m, "card", "integration", IdempotencyKey: key), CancellationToken.None);
        create1.Success.Should().BeTrue();
        var id1 = create1.Data!.Id;

        var create2 = await handler.Handle(new CreatePaymentCommand(1, guest.Id, null, null, 500m, "card", "integration", IdempotencyKey: key), CancellationToken.None);
        create2.Success.Should().BeTrue();
        create2.Data!.Id.Should().Be(id1, "replaying the idempotency key returns the original payment");

        (await ctx.Payments.CountAsync()).Should().Be(1, "the filtered unique index must prevent a duplicate row");
    }
}
