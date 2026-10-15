using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Expenses
{
    /// <summary>Fetches one expense by id.</summary>
    public record GetExpenseQuery(int Id) : IRequest<Result<ExpenseDto>>;

    public class GetExpenseHandler : IRequestHandler<GetExpenseQuery, Result<ExpenseDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetExpenseHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<ExpenseDto>> Handle(GetExpenseQuery request, CancellationToken cancellationToken)
        {
            var expense = await _context.Expenses
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            return expense is null
                ? Result<ExpenseDto>.NotFoundResult()
                : Result<ExpenseDto>.SuccessResult(ExpenseDto.FromEntity(expense));
        }
    }

    /// <summary>Lists expenses, optionally filtered by property, status, and category.</summary>
    public record GetExpensesQuery(int? PropertyId, string? Status, string? Category) : IRequest<List<ExpenseDto>>;

    public class GetExpensesHandler : IRequestHandler<GetExpensesQuery, List<ExpenseDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetExpensesHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<ExpenseDto>> Handle(GetExpensesQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Expenses.AsNoTracking().AsQueryable();

            if (request.PropertyId.HasValue)
                query = query.Where(e => e.PropertyId == request.PropertyId.Value);
            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                var status = request.Status.Trim().ToLower();
                query = query.Where(e => e.Status == status);
            }
            if (!string.IsNullOrWhiteSpace(request.Category))
            {
                var category = request.Category.Trim().ToLower();
                query = query.Where(e => e.Category.ToLower() == category);
            }

            var expenses = await query.OrderByDescending(e => e.Date).ToListAsync(cancellationToken);
            return expenses.Select(ExpenseDto.FromEntity).ToList();
        }
    }
}
