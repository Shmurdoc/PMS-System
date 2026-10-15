using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Inventory
{
    /// <summary>Fetches one stock item by id.</summary>
    public record GetInventoryItemQuery(int Id) : IRequest<Result<InventoryItemDto>>;

    public class GetInventoryItemHandler : IRequestHandler<GetInventoryItemQuery, Result<InventoryItemDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetInventoryItemHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<InventoryItemDto>> Handle(GetInventoryItemQuery request, CancellationToken cancellationToken)
        {
            var item = await _context.InventoryItems
                .AsNoTracking()
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            return item is null
                ? Result<InventoryItemDto>.NotFoundResult()
                : Result<InventoryItemDto>.SuccessResult(InventoryItemDto.FromEntity(item));
        }
    }

    /// <summary>Lists stock items, optionally filtered by property, category, or name.</summary>
    public record GetInventoryItemsQuery(int? PropertyId, string? Category, string? Search) : IRequest<List<InventoryItemDto>>;

    public class GetInventoryItemsHandler : IRequestHandler<GetInventoryItemsQuery, List<InventoryItemDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetInventoryItemsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<InventoryItemDto>> Handle(GetInventoryItemsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.InventoryItems.AsNoTracking().AsQueryable();

            if (request.PropertyId.HasValue)
                query = query.Where(i => i.PropertyId == request.PropertyId.Value);
            if (!string.IsNullOrWhiteSpace(request.Category))
            {
                var category = request.Category.Trim().ToLower();
                query = query.Where(i => i.Category.ToLower() == category);
            }
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var term = request.Search.Trim().ToLower();
                query = query.Where(i => i.Name.ToLower().Contains(term) || i.Supplier.ToLower().Contains(term));
            }

            var items = await query.OrderBy(i => i.Name).ToListAsync(cancellationToken);
            return items.Select(InventoryItemDto.FromEntity).ToList();
        }
    }
}
