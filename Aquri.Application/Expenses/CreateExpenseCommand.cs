using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.Expenses
{
    /// <summary>Submits a new expense. <paramref name="SubmittedBy"/> is stamped by the controller from the JWT.</summary>
    public record CreateExpenseCommand(
        int PropertyId,
        string Category,
        decimal Amount,
        string Description,
        DateTime Date,
        string SubmittedBy,
        string? ReceiptUrl,
        string? Vendor,
        string? PaymentMethod,
        string? Notes) : IRequest<Result<ExpenseDto>>;

    public class CreateExpenseHandler : IRequestHandler<CreateExpenseCommand, Result<ExpenseDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public CreateExpenseHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<ExpenseDto>> Handle(CreateExpenseCommand request, CancellationToken cancellationToken)
        {
            try
            {
                var expense = new Expense(request.PropertyId, request.Category, request.Amount,
                    request.Description, request.Date, request.SubmittedBy, request.Vendor, request.Notes);

                if (!string.IsNullOrWhiteSpace(request.ReceiptUrl))
                    expense.SetReceipt(request.ReceiptUrl);
                if (!string.IsNullOrWhiteSpace(request.PaymentMethod))
                    expense.SetPaymentMethod(request.PaymentMethod);

                _context.Expenses.Add(expense);
                await _context.SaveChangesAsync(cancellationToken);

                AuditTrail.Write(_context, _currentUser, "create_expense", "expense", expense.Id.ToString(), expense.Description);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<ExpenseDto>.SuccessResult(ExpenseDto.FromEntity(expense));
            }
            catch (ArgumentException ex)
            {
                return Result<ExpenseDto>.Failure(ex.Message);
            }
        }
    }
}
