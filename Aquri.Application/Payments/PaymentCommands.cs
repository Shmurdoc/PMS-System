using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Payments
{
    /// <summary>
    /// Completes a pending/processing payment (e.g. gateway confirmed). When the
    /// payment is attached to an invoice, the invoice settles in the same
    /// SaveChanges, so the money row and the invoice can never disagree.
    /// </summary>
    public record CompletePaymentCommand(int Id, string? TransactionId) : IRequest<Result<PaymentDto>>;

    public class CompletePaymentHandler : IRequestHandler<CompletePaymentCommand, Result<PaymentDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public CompletePaymentHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<PaymentDto>> Handle(CompletePaymentCommand request, CancellationToken cancellationToken)
        {
            var payment = await _context.Payments
                .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

            if (payment is null)
                return Result<PaymentDto>.NotFoundResult();

            // A retried completion (double click, network retry) already did the
            // work. Answer with the current row instead of recording it twice.
            if (payment.Status == PaymentStatus.Completed)
                return Result<PaymentDto>.SuccessResult(PaymentDto.FromEntity(payment));

            var invoice = await LoadInvoiceAsync(payment, cancellationToken);
            if (invoice is null && payment.InvoiceId.HasValue)
                return Result<PaymentDto>.Failure("The invoice attached to this payment no longer exists.");

            try
            {
                payment.Complete(request.TransactionId);
                invoice?.RecordPayment(payment.Amount, payment.Method);
                AuditTrail.Write(_context, _currentUser, "complete_payment", "payment", payment.Id.ToString(), payment.ProcessedBy);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<PaymentDto>.SuccessResult(PaymentDto.FromEntity(payment));
            }
            catch (DomainException ex)
            {
                return Result<PaymentDto>.ConflictResult(ex.Message);
            }
        }

        private async Task<Invoice?> LoadInvoiceAsync(Payment payment, CancellationToken cancellationToken)
        {
            if (!payment.InvoiceId.HasValue)
                return null;

            return await _context.Invoices
                .FirstOrDefaultAsync(i => i.Id == payment.InvoiceId.Value, cancellationToken);
        }
    }

    /// <summary>
    /// Refunds a completed payment. The invoice is reversed in the same
    /// SaveChanges, so a refund cannot leave an invoice looking settled.
    /// </summary>
    public record RefundPaymentCommand(int Id) : IRequest<Result<PaymentDto>>;

    public class RefundPaymentHandler : IRequestHandler<RefundPaymentCommand, Result<PaymentDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public RefundPaymentHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<PaymentDto>> Handle(RefundPaymentCommand request, CancellationToken cancellationToken)
        {
            var payment = await _context.Payments
                .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

            if (payment is null)
                return Result<PaymentDto>.NotFoundResult();

            // Same reasoning as completion: a repeated refund is not a second one.
            if (payment.Status == PaymentStatus.Refunded)
                return Result<PaymentDto>.SuccessResult(PaymentDto.FromEntity(payment));

            var invoice = payment.InvoiceId.HasValue
                ? await _context.Invoices.FirstOrDefaultAsync(i => i.Id == payment.InvoiceId.Value, cancellationToken)
                : null;

            try
            {
                payment.Refund();
                invoice?.ReversePayment(payment.Amount);
                AuditTrail.Write(_context, _currentUser, "refund_payment", "payment", payment.Id.ToString(), payment.ProcessedBy);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<PaymentDto>.SuccessResult(PaymentDto.FromEntity(payment));
            }
            catch (DomainException ex)
            {
                return Result<PaymentDto>.ConflictResult(ex.Message);
            }
        }
    }

    public record GetPaymentsQuery(int PropertyId, string? Status, int Page = 1, int PageSize = 50) : IRequest<PagedRows<PaymentDto>>;

    public class GetPaymentsHandler : IRequestHandler<GetPaymentsQuery, PagedRows<PaymentDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public GetPaymentsHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<PagedRows<PaymentDto>> Handle(GetPaymentsQuery request, CancellationToken cancellationToken)
        {
            var page = Math.Clamp(request.Page, 1, int.MaxValue);
            var pageSize = Math.Clamp(request.PageSize, 1, 200);

            var query = _context.Payments
                .AsNoTracking()
                .Where(p => p.PropertyId == request.PropertyId);

            // Defense in depth: a scoped caller may only read their own property's
            // payments, even if they supply a different PropertyId in the request.
            if (_currentUser.UserRole != AppRoles.Admin && _currentUser.PropertyIds.Count > 0)
                query = query.Where(p => _currentUser.PropertyIds.Contains(p.PropertyId));

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                if (!PaymentStatusExtensions.TryParseWire(request.Status, out var statusFilter))
                    return new PagedRows<PaymentDto>();

                query = query.Where(p => p.Status == statusFilter);
            }

            var totalCount = await query.CountAsync(cancellationToken);
            var payments = await query
                .OrderByDescending(p => p.Created)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new PagedRows<PaymentDto>
            {
                Data = payments.Select(PaymentDto.FromEntity).ToList(),
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }
    }
}
