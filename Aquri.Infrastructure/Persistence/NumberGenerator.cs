using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Infrastructure.Persistence
{
    /// <summary>
    /// Issues unique business numbers (TKT-2026-00001, INV-…, PAY-…) from
    /// NumberSequence rows — one row per prefix+year, bumped on the scoped
    /// DbContext so the increment commits atomically with the caller's
    /// SaveChanges (failed insert => rolled-back counter, no stale bump).
    ///
    /// On first use for a key the counter seeds from the highest suffix already
    /// on file for that prefix+year, so numbers issued by the legacy
    /// clock-ticks scheme are never reissued. If two requests ever race past
    /// the counter, the unique indexes on TicketNumber/InvoiceNumber/PaymentNumber
    /// reject the loser and ApiResponseMiddleware surfaces it as 409 CONFLICT.
    /// </summary>
    public class NumberGenerator : INumberGenerator
    {
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
            return $"{key}-{sequence.CurrentValue:D5}";
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
