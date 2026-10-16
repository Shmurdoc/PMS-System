using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Payments
{
    /// <summary>Completes a pending/processing payment (e.g. gateway confirmed).</summary>
    public record CompletePaymentCommand(int Id, string? TransactionId) : IRequest<Result<PaymentDto>>;

    public class CompletePaymentHandler : IRequestHandler<CompletePaymentCommand, Result<PaymentDto>>
    {
        private readonly IApplicationDbContext _context;

        public CompletePaymentHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<PaymentDto>> Handle(CompletePaymentCommand request, CancellationToken cancellationToken)
        {
            var payment = await _context.Payments
                .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

            if (payment is null)
                return Result<PaymentDto>.NotFoundResult();

            try
            {
                payment.Complete(request.TransactionId);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<PaymentDto>.SuccessResult(PaymentDto.FromEntity(payment));
            }
            catch (DomainException ex)
            {
                return Result<PaymentDto>.Failure(ex.Message);
            }
        }
    }

    /// <summary>Refunds a completed payment — one-way, no re-completion.</summary>
    public record RefundPaymentCommand(int Id) : IRequest<Result<PaymentDto>>;

    public class RefundPaymentHandler : IRequestHandler<RefundPaymentCommand, Result<PaymentDto>>
    {
        private readonly IApplicationDbContext _context;

        public RefundPaymentHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<PaymentDto>> Handle(RefundPaymentCommand request, CancellationToken cancellationToken)
        {
            var payment = await _context.Payments
                .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

            if (payment is null)
                return Result<PaymentDto>.NotFoundResult();

            try
            {
                payment.Refund();
                await _context.SaveChangesAsync(cancellationToken);
                return Result<PaymentDto>.SuccessResult(PaymentDto.FromEntity(payment));
            }
            catch (DomainException ex)
            {
                return Result<PaymentDto>.Failure(ex.Message);
            }
        }
    }

    public record GetPaymentsQuery(int PropertyId, string? Status) : IRequest<List<PaymentDto>>;

    public class GetPaymentsHandler : IRequestHandler<GetPaymentsQuery, List<PaymentDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetPaymentsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<PaymentDto>> Handle(GetPaymentsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Payments
                .AsNoTracking()
                .Where(p => p.PropertyId == request.PropertyId);

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                if (!PaymentStatusExtensions.TryParseWire(request.Status, out var statusFilter))
                    return new List<PaymentDto>();

                query = query.Where(p => p.Status == statusFilter);
            }

            var payments = await query.OrderByDescending(p => p.Created).ToListAsync(cancellationToken);
            return payments.Select(PaymentDto.FromEntity).ToList();
        }
    }
}
