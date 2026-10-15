using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Infrastructure.Persistence
{
    /// <summary>
    /// Issues unique business numbers (TKT-2026-00001, INV-…, PAY-…) from
    /// NumberSequence rows — one row per prefix+year. The increment is persisted
    /// immediately (before the caller's SaveChanges) so a concurrent racer is
    /// detected here via the CurrentValue optimistic-concurrency token and
    /// resolved by reloading and retrying, instead of both requests silently
    /// receiving the same number and the loser failing later with a 409.
    ///
    /// Because the bump commits independently, a caller whose own insert
    /// subsequently fails leaves a gap in the number series — gaps are
    /// acceptable for business numbering; duplicates are not. The unique
    /// indexes on TicketNumber/InvoiceNumber/PaymentNumber remain the final
    /// backstop against any residual race.
    /// </summary>
    public class NumberGenerator : INumberGenerator
    {
        private const int MaxAttempts = 5;

        private readonly IApplicationDbContext _context;

        public NumberGenerator(IApplicationDbContext context) => _context = context;

        public Task<string> NextTicketNumberAsync(CancellationToken cancellationToken = default) =>
            NextAsync("TKT", _context.Tickets.Select(t => t.TicketNumber), cancellationToken);

        public Task<string> NextInvoiceNumberAsync(CancellationToken cancellationToken = default) =>
            NextAsync("INV", _context.Invoices.Select(i => i.InvoiceNumber), cancellationToken);

        public Task<string> NextPaymentNumberAsync(CancellationToken cancellationToken = default) =>
            NextAsync("PAY", _context.Payments.Select(p => p.PaymentNumber), cancellationToken);

        private async Task<string> NextAsync(string prefix, IQueryable<string> existingNumbers, CancellationToken cancellationToken)
        {
            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    var year = DateTime.UtcNow.Year;
                    var key = $"{prefix}-{year}";

                    var sequence = await _context.NumberSequences.FindAsync(new object[] { key }, cancellationToken);
                    if (sequence is null)
                    {
                        sequence = new NumberSequence
                        {
                            Key = key,
                            CurrentValue = await SeedFromExistingNumbersAsync(key, existingNumbers, cancellationToken)
                        };
                        _context.NumberSequences.Add(sequence);
                    }

                    sequence.CurrentValue++;
                    // Persist the bump now: the concurrency token turns a racer
                    // into a retryable DbUpdateException at this point rather
                    // than a duplicate number at the caller's save.
                    await _context.SaveChangesAsync(cancellationToken);
                    return $"{key}-{sequence.CurrentValue:D5}";
                }
                catch (DbUpdateException) when (attempt < MaxAttempts)
                {
                    // Detach the stale sequence row(s) so the next attempt
                    // reloads fresh state (the winner's value) from the store.
                    foreach (var entry in _context.ChangeTracker.Entries<NumberSequence>().ToList())
                        entry.State = EntityState.Detached;
                }
            }
        }

        /// <summary>
        /// Highest suffix among numbers already issued for this prefix+year
        /// (legacy clock-ticks numbers share the same PREFIX-year-##### shape).
        /// Runs once per key, when the counter row is first created.
        /// </summary>
        private static async Task<long> SeedFromExistingNumbersAsync(string key, IQueryable<string> existingNumbers, CancellationToken cancellationToken)
        {
            var needle = key + "-";
            var numbers = await existingNumbers
                .Where(n => n != null && n.StartsWith(needle))
                .ToListAsync(cancellationToken);

            long max = 0;
            foreach (var number in numbers)
            {
                var separator = number.LastIndexOf('-');
                if (separator > 0 && long.TryParse(number[(separator + 1)..], out var suffix) && suffix > max)
                    max = suffix;
            }

            return max;
        }
    }
}
