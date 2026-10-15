using System;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.Payments
{
    /// <summary>Creates a pending payment; complete/refund transition happens separately.</summary>
    public record CreatePaymentCommand(
        int PropertyId,
        int GuestId,
        int? InvoiceId,
        int? BookingId,
        decimal Amount,
        string Method,
        string ProcessedBy) : IRequest<Result<PaymentDto>>;

    public class CreatePaymentHandler : IRequestHandler<CreatePaymentCommand, Result<PaymentDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly INumberGenerator _numbers;

        public CreatePaymentHandler(IApplicationDbContext context, INumberGenerator numbers)
        {
            _context = context;
            _numbers = numbers;
        }

        public async Task<Result<PaymentDto>> Handle(CreatePaymentCommand request, CancellationToken cancellationToken)
        {
            // The invoice/booking FKs are client-supplied IDs — verify they exist
            // and belong to the same property before stamping them onto the
            // payment, otherwise dangling or cross-property references persist.
            var guest = await _context.Guests.FindAsync(request.GuestId);
            if (guest is null)
                return Result<PaymentDto>.Failure("Guest not found.");

            if (request.InvoiceId.HasValue)
            {
                var invoice = await _context.Invoices.FindAsync(request.InvoiceId.Value);
                if (invoice is null)
                    return Result<PaymentDto>.Failure("Invoice not found.");
                if (invoice.PropertyId != request.PropertyId)
                    return Result<PaymentDto>.Failure("Invoice does not belong to the specified property.");
            }

            if (request.BookingId.HasValue)
            {
                var booking = await _context.Bookings.FindAsync(request.BookingId.Value);
                if (booking is null)
                    return Result<PaymentDto>.Failure("Booking not found.");
                if (booking.PropertyId != request.PropertyId)
                    return Result<PaymentDto>.Failure("Booking does not belong to the specified property.");
            }

            var paymentNumber = await _numbers.NextPaymentNumberAsync(cancellationToken);

            try
            {
                var payment = new Payment(paymentNumber, request.GuestId, request.PropertyId,
                    request.Amount, request.Method, request.ProcessedBy);

                if (request.InvoiceId.HasValue)
                    payment.AttachToInvoice(request.InvoiceId.Value);
                if (request.BookingId.HasValue)
                    payment.AttachToBooking(request.BookingId.Value);

                _context.Payments.Add(payment);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<PaymentDto>.SuccessResult(PaymentDto.FromEntity(payment));
            }
            catch (ArgumentException ex)
            {
                return Result<PaymentDto>.Failure(ex.Message);
            }
        }
    }
}
