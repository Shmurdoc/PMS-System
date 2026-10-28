using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Invoices
{
    /// <summary>Sends a draft or pending invoice (Draft → Sent or Pending → Sent).</summary>
    public record SendInvoiceCommand(int Id, string? SentBy) : IRequest<Result<InvoiceDto>>;

    public class SendInvoiceHandler : IRequestHandler<SendInvoiceCommand, Result<InvoiceDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public SendInvoiceHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<InvoiceDto>> Handle(SendInvoiceCommand request, CancellationToken cancellationToken)
        {
            var invoice = await _context.Invoices
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (invoice is null)
                return Result<InvoiceDto>.NotFoundResult();

            if (!Invoice.CanTransitionTo(invoice.Status, InvoiceStatus.Sent))
                return Result<InvoiceDto>.ConflictResult(
                    $"Cannot send an invoice in status '{invoice.Status.ToWire()}'.");

            invoice.ChangeStatus(InvoiceStatus.Sent);
            AuditTrail.Write(_context, _currentUser, "send_invoice", "invoice", invoice.Id.ToString(), invoice.InvoiceNumber);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<InvoiceDto>.SuccessResult(InvoiceDto.FromEntity(invoice));
        }
    }
}
