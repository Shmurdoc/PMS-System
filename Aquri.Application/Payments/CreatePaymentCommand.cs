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
