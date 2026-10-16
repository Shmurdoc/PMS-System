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

        public DeleteInvoiceHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result> Handle(DeleteInvoiceCommand request, CancellationToken cancellationToken)
        {
            var invoice = await _context.Invoices
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (invoice is null)
                return Result.NotFoundResult();

            _context.Invoices.Remove(invoice);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
