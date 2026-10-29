using System;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests
{
    /// <summary>NumberGenerator allocates TKT-/INV-/PAY- numbers from NumberSequence rows. Verifies monotonic allocation, per-prefix/per-year keying, that the first reservation never reissues a legacy clock-ticks number, and that the counter persists across DbContext instances.</summary>
    public class NumberGeneratorTests : IDisposable
    {
        private readonly string _databaseName = $"number-generator-{Guid.NewGuid():N}";
        private readonly AquriDbContext _context;

        public NumberGeneratorTests()
        {
            _context = CreateContext();
        }

        private AquriDbContext CreateContext() =>
            new(new DbContextOptionsBuilder<AquriDbContext>()
                .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory, Aquri.Infrastructure.Persistence.PropertyScopeModelCacheKeyFactory>()
                .UseInMemoryDatabase(_databaseName)
                .Options);

        public void Dispose() => _context.Dispose();

        [Fact]
        public async Task First_Reserve_For_A_Key_Starts_At_One()
        {
            var generator = new NumberGenerator(_context);

            var number = await generator.NextTicketNumberAsync(CancellationToken.None);

            number.Should().Be($"TKT-{DateTime.UtcNow.Year}-00001");
        }

        [Fact]
        public async Task Sequential_Reserves_Monotonic_Increment()
        {
            var generator = new NumberGenerator(_context);

            var first = await generator.NextTicketNumberAsync(CancellationToken.None);
            var second = await generator.NextTicketNumberAsync(CancellationToken.None);
            var third = await generator.NextTicketNumberAsync(CancellationToken.None);

            var year = DateTime.UtcNow.Year;
            first.Should().Be($"TKT-{year}-00001");
            second.Should().Be($"TKT-{year}-00002");
            third.Should().Be($"TKT-{year}-00003");
        }

        [Fact]
        public async Task Different_Prefixes_Use_Independent_Counters()
        {
            var generator = new NumberGenerator(_context);

            var ticket = await generator.NextTicketNumberAsync(CancellationToken.None);
            var invoice = await generator.NextInvoiceNumberAsync(CancellationToken.None);
            var payment = await generator.NextPaymentNumberAsync(CancellationToken.None);

            var year = DateTime.UtcNow.Year;
            ticket.Should().Be($"TKT-{year}-00001");
            invoice.Should().Be($"INV-{year}-00001");
            payment.Should().Be($"PAY-{year}-00001");
        }

        [Fact]
        public async Task First_Reserve_Skips_Numbers_Already_On_File()
        {
            // Legacy clock-ticks numbers share the PREFIX-year-##### shape —
            // the counter must seed past them instead of reissuing 00043…
            _context.Tickets.Add(new Ticket(
                $"TKT-{DateTime.UtcNow.Year}-00042",
                "Legacy ticket", "Issued before the sequence counter existed.",
                TicketType.Issue, "maintenance", TicketPriority.Low, 1, 1, "Front Desk"));
            await _context.SaveChangesAsync(CancellationToken.None);

            var generator = new NumberGenerator(_context);
            var number = await generator.NextTicketNumberAsync(CancellationToken.None);

            number.Should().Be($"TKT-{DateTime.UtcNow.Year}-00043");
        }

        [Fact]
        public async Task Counter_Persists_Across_DbContext_Instances()
        {
            var generator = new NumberGenerator(_context);
            var first = await generator.NextTicketNumberAsync(CancellationToken.None);
            await _context.SaveChangesAsync(CancellationToken.None);

            // Same database, fresh context — proves the counter was written,
            // not merely tracked in the first context.
            using var freshContext = CreateContext();
            var freshGenerator = new NumberGenerator(freshContext);
            var second = await freshGenerator.NextTicketNumberAsync(CancellationToken.None);

            first.Should().Be($"TKT-{DateTime.UtcNow.Year}-00001");
            second.Should().Be($"TKT-{DateTime.UtcNow.Year}-00002");
        }
    }
}
