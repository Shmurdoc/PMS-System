using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Invoices
{
    /// <summary>Deletes an invoice. Nothing references an invoice with Restrict: line items cascade with the invoice and payments detach (FK SetNull — the money records are preserved), so no conflict guard is needed.</summary>
    public record DeleteInvoiceCommand(int Id) : IRequest<Result>;

    public class DeleteInvoiceHandler : IRequestHandler<DeleteInvoiceCommand, Result>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public DeleteInvoiceHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result> Handle(DeleteInvoiceCommand request, CancellationToken cancellationToken)
        {
            var invoice = await _context.Invoices
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (invoice is null)
                return Result.NotFoundResult();

            var invoiceId = invoice.Id.ToString();
            invoice.SoftDelete();
            AuditTrail.Write(_context, _currentUser, "delete_invoice", "invoice", invoiceId, invoice.InvoiceNumber);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }

    /// <summary>Permanently purges an invoice (GDPR right to be forgotten). Irreversible — audit rows are kept but the invoice row is removed.</summary>
    public record PurgeInvoiceCommand(int Id) : IRequest<Result>;

    public class PurgeInvoiceHandler : IRequestHandler<PurgeInvoiceCommand, Result>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public PurgeInvoiceHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result> Handle(PurgeInvoiceCommand request, CancellationToken cancellationToken)
        {
            // IgnoreQueryFilters so we can find already-soft-deleted invoices.
            var invoice = await _context.Invoices
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (invoice is null)
                return Result.NotFoundResult();

            var invoiceId = invoice.Id.ToString();
            _context.Invoices.Remove(invoice);
            AuditTrail.Write(_context, _currentUser, "purge_invoice", "invoice", invoiceId, invoice.InvoiceNumber);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
