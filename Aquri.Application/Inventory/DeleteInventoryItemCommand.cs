using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Inventory
{
    public record DeleteInventoryItemCommand(int Id) : IRequest<Result<bool>>;

    public class DeleteInventoryItemHandler : IRequestHandler<DeleteInventoryItemCommand, Result<bool>>
    {
        private readonly IApplicationDbContext _context;

        public DeleteInventoryItemHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<bool>> Handle(DeleteInventoryItemCommand request, CancellationToken cancellationToken)
        {
            var item = await _context.InventoryItems
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (item is null)
                return Result<bool>.NotFoundResult();

            _context.InventoryItems.Remove(item);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<bool>.SuccessResult(true);
        }
    }
}
