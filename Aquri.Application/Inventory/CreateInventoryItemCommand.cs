using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.Inventory
{
    public record CreateInventoryItemCommand(
        int PropertyId,
        string Name,
        string Category,
        int Quantity,
        string Unit,
        int ReorderLevel,
        decimal Price,
        string Supplier,
        string? Sku = null,
        DateTime? ExpiryDate = null,
        int? MinOrderQuantity = null) : IRequest<Result<InventoryItemDto>>;

    public class CreateInventoryItemHandler : IRequestHandler<CreateInventoryItemCommand, Result<InventoryItemDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateInventoryItemHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<InventoryItemDto>> Handle(CreateInventoryItemCommand request, CancellationToken cancellationToken)
        {
            try
            {
                var item = new InventoryItem(request.PropertyId, request.Name, request.Category,
                    request.Quantity, request.Unit, request.ReorderLevel, request.Price, request.Supplier);

                if (!string.IsNullOrWhiteSpace(request.Sku))
                    item.SetSku(request.Sku);
                if (request.ExpiryDate.HasValue)
                    item.SetExpiry(request.ExpiryDate);
                if (request.MinOrderQuantity.HasValue)
                    item.SetMinOrderQuantity(request.MinOrderQuantity);

                _context.InventoryItems.Add(item);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<InventoryItemDto>.SuccessResult(InventoryItemDto.FromEntity(item));
            }
            catch (ArgumentException ex)
            {
                return Result<InventoryItemDto>.Failure(ex.Message);
            }
        }
    }
}
