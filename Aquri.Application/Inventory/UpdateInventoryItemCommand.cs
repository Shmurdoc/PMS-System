using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Inventory
{
    /// <summary>Edits a stock item's details. Omitted fields keep their current values; send an empty string to clear location/notes.</summary>
    public record UpdateInventoryItemCommand(
        int Id,
        string? Name,
        string? Category,
        string? Unit,
        int? ReorderLevel,
        decimal? Price,
        string? Supplier,
        string? Location,
        string? Notes,
        string? Sku,
        DateTime? ExpiryDate,
        int? MinOrderQuantity) : IRequest<Result<InventoryItemDto>>;

    public class UpdateInventoryItemHandler : IRequestHandler<UpdateInventoryItemCommand, Result<InventoryItemDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateInventoryItemHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<InventoryItemDto>> Handle(UpdateInventoryItemCommand request, CancellationToken cancellationToken)
        {
            var item = await _context.InventoryItems
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (item is null)
                return Result<InventoryItemDto>.NotFoundResult();

            try
            {
                item.UpdateDetails(
                    request.Name ?? item.Name,
                    request.Category ?? item.Category,
                    request.Unit ?? item.Unit,
                    request.ReorderLevel ?? item.ReorderLevel,
                    request.Price ?? item.Price,
                    request.Supplier ?? item.Supplier,
                    request.Location ?? item.Location,
                    request.Notes ?? item.Notes);

                if (request.Sku is not null)
                    item.SetSku(request.Sku);
                if (request.ExpiryDate.HasValue)
                    item.SetExpiry(request.ExpiryDate);
                if (request.MinOrderQuantity.HasValue)
                    item.SetMinOrderQuantity(request.MinOrderQuantity);

                await _context.SaveChangesAsync(cancellationToken);
                return Result<InventoryItemDto>.SuccessResult(InventoryItemDto.FromEntity(item));
            }
            catch (ArgumentException ex)
            {
                return Result<InventoryItemDto>.Failure(ex.Message);
            }
        }
    }

    /// <summary>Applies a signed stock adjustment (negative for usage, positive for corrections).</summary>
    public record AdjustInventoryQuantityCommand(int Id, int Delta) : IRequest<Result<InventoryItemDto>>;

    public class AdjustInventoryQuantityHandler : IRequestHandler<AdjustInventoryQuantityCommand, Result<InventoryItemDto>>
    {
        private readonly IApplicationDbContext _context;

        public AdjustInventoryQuantityHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<InventoryItemDto>> Handle(AdjustInventoryQuantityCommand request, CancellationToken cancellationToken)
        {
            var item = await _context.InventoryItems
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (item is null)
                return Result<InventoryItemDto>.NotFoundResult();

            try
            {
                item.AdjustQuantity(request.Delta);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<InventoryItemDto>.SuccessResult(InventoryItemDto.FromEntity(item));
            }
            catch (DomainException ex)
            {
                return Result<InventoryItemDto>.Failure(ex.Message);
            }
        }
    }

    /// <summary>Records a delivery: bumps quantity and stamps the restock date.</summary>
    public record RestockInventoryItemCommand(int Id, int QuantityAdded) : IRequest<Result<InventoryItemDto>>;

    public class RestockInventoryItemHandler : IRequestHandler<RestockInventoryItemCommand, Result<InventoryItemDto>>
    {
        private readonly IApplicationDbContext _context;

        public RestockInventoryItemHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<InventoryItemDto>> Handle(RestockInventoryItemCommand request, CancellationToken cancellationToken)
        {
            var item = await _context.InventoryItems
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (item is null)
                return Result<InventoryItemDto>.NotFoundResult();

            try
            {
                item.Restock(request.QuantityAdded);
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
