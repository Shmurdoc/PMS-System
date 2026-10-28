using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Invoices
{
    /// <summary>Cancels an invoice and detaches its linked payments (kept for audit).</summary>
    public record CancelInvoiceCommand(int Id, string? CancelledBy) : IRequest<Result<InvoiceDto>>;

    public class CancelInvoiceHandler : IRequestHandler<CancelInvoiceCommand, Result<InvoiceDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public CancelInvoiceHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<InvoiceDto>> Handle(CancelInvoiceCommand request, CancellationToken cancellationToken)
        {
            var invoice = await _context.Invoices
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (invoice is null)
                return Result<InvoiceDto>.NotFoundResult();

            if (!Invoice.CanTransitionTo(invoice.Status, InvoiceStatus.Cancelled))
                return Result<InvoiceDto>.ConflictResult(
                    $"Cannot cancel an invoice in status '{invoice.Status.ToWire()}'.");

            // Detach linked payments: they are kept (audit trail) but no longer
            // bound to this invoice. Their status is unchanged.
            var payments = await _context.Payments
                .Where(p => p.InvoiceId == request.Id)
                .ToListAsync(cancellationToken);
            foreach (var payment in payments)
                payment.DetachFromInvoice();

            invoice.ChangeStatus(InvoiceStatus.Cancelled);
            AuditTrail.Write(_context, _currentUser, "cancel_invoice", "invoice", invoice.Id.ToString(), invoice.InvoiceNumber);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<InvoiceDto>.SuccessResult(InvoiceDto.FromEntity(invoice));
        }
    }
}
