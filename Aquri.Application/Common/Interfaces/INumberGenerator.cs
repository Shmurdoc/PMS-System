namespace Aquri.Application.Common.Interfaces
{
    /// <summary>
    /// Allocates unique business numbers (TKT-/INV-/PAY-YYYY-#####) from
    /// NumberSequence rows instead of the clock, so concurrent creates cannot
    /// collide. The reservation is tracked on the same scoped DbContext as the
    /// consuming entity and persists with that entity's SaveChanges.
    /// </summary>
    public interface INumberGenerator
    {
        Task<string> NextTicketNumberAsync(CancellationToken cancellationToken = default);
        Task<string> NextInvoiceNumberAsync(CancellationToken cancellationToken = default);
        Task<string> NextPaymentNumberAsync(CancellationToken cancellationToken = default);
    }
}
