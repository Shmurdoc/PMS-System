using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Expenses
{
    public record UpdateExpenseCommand(
        int Id,
        string Category,
        decimal Amount,
        string Description,
        DateTime Date,
        string? Vendor,
        string? Notes,
        string? ReceiptUrl = null,
        string? PaymentMethod = null) : IRequest<Result<ExpenseDto>>;

    public class UpdateExpenseHandler : IRequestHandler<UpdateExpenseCommand, Result<ExpenseDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateExpenseHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<ExpenseDto>> Handle(UpdateExpenseCommand request, CancellationToken cancellationToken)
        {
            var expense = await _context.Expenses
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            if (expense is null)
                return Result<ExpenseDto>.NotFoundResult();

            try
            {
                if (request.PaymentMethod is not null)
                    expense.SetPaymentMethod(request.PaymentMethod);
                if (request.ReceiptUrl is not null)
                    expense.SetReceipt(request.ReceiptUrl);

                expense.UpdateDetails(request.Category, request.Amount, request.Description,
                    request.Date, request.Vendor, request.Notes);

                await _context.SaveChangesAsync(cancellationToken);
                return Result<ExpenseDto>.SuccessResult(ExpenseDto.FromEntity(expense));
            }
            catch (ArgumentException ex)
            {
                return Result<ExpenseDto>.Failure(ex.Message);
            }
            catch (DomainException ex)
            {
                return Result<ExpenseDto>.Failure(ex.Message);
            }
        }
    }
}
