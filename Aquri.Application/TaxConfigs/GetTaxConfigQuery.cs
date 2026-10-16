using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.TaxConfigs
{
    public record GetTaxConfigQuery(int Id) : IRequest<Result<TaxConfigDto>>;

    public class GetTaxConfigHandler : IRequestHandler<GetTaxConfigQuery, Result<TaxConfigDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetTaxConfigHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<TaxConfigDto>> Handle(GetTaxConfigQuery request, CancellationToken cancellationToken)
        {
            var tax = await _context.TaxConfigs
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

            return tax is null
                ? Result<TaxConfigDto>.NotFoundResult()
                : Result<TaxConfigDto>.SuccessResult(TaxConfigDto.FromEntity(tax));
        }
    }

    public record GetTaxConfigsQuery(int? PropertyId, string? Type, bool? Active) : IRequest<List<TaxConfigDto>>;

    public class GetTaxConfigsHandler : IRequestHandler<GetTaxConfigsQuery, List<TaxConfigDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetTaxConfigsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<TaxConfigDto>> Handle(GetTaxConfigsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.TaxConfigs.AsNoTracking().AsQueryable();

            if (request.PropertyId.HasValue)
                query = query.Where(t => t.PropertyId == request.PropertyId.Value);
            if (!string.IsNullOrWhiteSpace(request.Type))
                query = query.Where(t => t.Type == request.Type);
            if (request.Active.HasValue)
                query = query.Where(t => t.Active == request.Active.Value);

            var taxes = await query
                .OrderByDescending(t => t.Active)
                .ThenBy(t => t.Type)
                .ThenBy(t => t.Name)
                .ToListAsync(cancellationToken);

            return taxes.Select(TaxConfigDto.FromEntity).ToList();
        }
    }
}
