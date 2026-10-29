using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Invoices
{
    /// <summary>Detaches a payment from an invoice (keeps the payment row for audit).</summary>
    public record DetachPaymentCommand(int InvoiceId, int PaymentId) : IRequest<Result>;

    public class DetachPaymentHandler : IRequestHandler<DetachPaymentCommand, Result>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public DetachPaymentHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result> Handle(DetachPaymentCommand request, CancellationToken cancellationToken)
        {
            var payment = await _context.Payments
                .FirstOrDefaultAsync(p => p.Id == request.PaymentId, cancellationToken);

            if (payment is null)
                return Result.NotFoundResult();
            if (payment.InvoiceId != request.InvoiceId)
                return Result.ConflictResult("That payment is not attached to the specified invoice.");

            payment.DetachFromInvoice();
            AuditTrail.Write(_context, _currentUser, "detach_payment", "payment", payment.Id.ToString(), payment.ProcessedBy);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
