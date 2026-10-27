using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Invoices
{
    /// <summary>Fetches one invoice with its items.</summary>
    public record GetInvoiceQuery(int Id) : IRequest<Result<InvoiceDto>>;

    public class GetInvoiceHandler : IRequestHandler<GetInvoiceQuery, Result<InvoiceDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetInvoiceHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<InvoiceDto>> Handle(GetInvoiceQuery request, CancellationToken cancellationToken)
        {
            var invoice = await _context.Invoices
                .AsNoTracking()
                .Include(i => i.Items)
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            return invoice is null
                ? Result<InvoiceDto>.NotFoundResult()
                : Result<InvoiceDto>.SuccessResult(InvoiceDto.FromEntity(invoice));
        }
    }

    public record GetInvoicesQuery(int PropertyId, string? Status) : IRequest<List<InvoiceDto>>;

    public class GetInvoicesHandler : IRequestHandler<GetInvoicesQuery, List<InvoiceDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetInvoicesHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<InvoiceDto>> Handle(GetInvoicesQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Invoices
                .AsNoTracking()
                .Include(i => i.Items)
                .Where(i => i.PropertyId == request.PropertyId);

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                if (!InvoiceStatusExtensions.TryParseWire(request.Status, out var statusFilter))
                    return new List<InvoiceDto>();

                query = query.Where(i => i.Status == statusFilter);
            }

            var invoices = await query.OrderByDescending(i => i.IssueDate).ToListAsync(cancellationToken);
            return invoices.Select(InvoiceDto.FromEntity).ToList();
        }
    }
}
