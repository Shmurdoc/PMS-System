namespace Aquri.Domain.Entities
{
    /// <summary>
    /// Per-key monotonic counter that backs unique business numbers
    /// (TKT-2026-00001, INV-…, PAY-…). One row per key (e.g. "TKT-2026");
    /// the counter is bumped on the scoped DbContext and committed in the same
    /// SaveChanges as the entity that consumes the number, so a rolled-back
    /// insert rolls the counter back with it. The unique indexes on
    /// TicketNumber / InvoiceNumber / PaymentNumber remain the final backstop.
    /// </summary>
    public class NumberSequence
    {
        /// <summary>Sequence key, e.g. "TKT-2026". Primary key.</summary>
        public string Key { get; set; } = string.Empty;

        /// <summary>Last reserved number for this key; the next reservation is this + 1.</summary>
        public long CurrentValue { get; set; }
    }
}
