using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Expenses
{
    /// <summary>Approves a pending expense. <paramref name="ApprovedBy"/> is stamped by the controller from the JWT.</summary>
    public record ApproveExpenseCommand(int Id, string ApprovedBy) : IRequest<Result<ExpenseDto>>;

    public class ApproveExpenseHandler : IRequestHandler<ApproveExpenseCommand, Result<ExpenseDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public ApproveExpenseHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<ExpenseDto>> Handle(ApproveExpenseCommand request, CancellationToken cancellationToken)
        {
            var expense = await _context.Expenses
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            if (expense is null)
                return Result<ExpenseDto>.NotFoundResult();

            try
            {
                expense.Approve(request.ApprovedBy);
                AuditTrail.Write(_context, _currentUser, "approve_expense", "expense", expense.Id.ToString(), expense.Description);
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

    /// <summary>Rejects a pending expense. <paramref name="RejectedBy"/> is stamped by the controller from the JWT.</summary>
    public record RejectExpenseCommand(int Id, string RejectedBy) : IRequest<Result<ExpenseDto>>;

    public class RejectExpenseHandler : IRequestHandler<RejectExpenseCommand, Result<ExpenseDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public RejectExpenseHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<ExpenseDto>> Handle(RejectExpenseCommand request, CancellationToken cancellationToken)
        {
            var expense = await _context.Expenses
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            if (expense is null)
                return Result<ExpenseDto>.NotFoundResult();

            try
            {
                expense.Reject(request.RejectedBy);
                AuditTrail.Write(_context, _currentUser, "reject_expense", "expense", expense.Id.ToString(), expense.Description);
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
