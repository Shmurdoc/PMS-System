using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Expenses
{
    /// <summary>Removes an expense (admin-only via the controller).</summary>
    public record DeleteExpenseCommand(int Id) : IRequest<Result<bool>>;

    public class DeleteExpenseHandler : IRequestHandler<DeleteExpenseCommand, Result<bool>>
    {
        private readonly IApplicationDbContext _context;

        public DeleteExpenseHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<bool>> Handle(DeleteExpenseCommand request, CancellationToken cancellationToken)
        {
            var expense = await _context.Expenses
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            if (expense is null)
                return Result<bool>.NotFoundResult();

            _context.Expenses.Remove(expense);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<bool>.SuccessResult(true);
        }
    }
}
