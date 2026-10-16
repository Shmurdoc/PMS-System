using FluentValidation;

namespace Aquri.Application.Expenses
{
    /// <summary>Shape checks for expense creation — approval workflow stays in the handler.</summary>
    public class CreateExpenseCommandValidator : AbstractValidator<CreateExpenseCommand>
    {
        public CreateExpenseCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.Category).NotEmpty().WithMessage("Category cannot be null or empty.");
            RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be positive.");
            RuleFor(x => x.Description).NotEmpty().WithMessage("Description cannot be null or empty.");
            RuleFor(x => x.SubmittedBy).NotEmpty().WithMessage("SubmittedBy cannot be null or empty.");
        }
    }

    /// <summary>Shape checks for expense edits — status transitions stay in the handler.</summary>
    public class UpdateExpenseCommandValidator : AbstractValidator<UpdateExpenseCommand>
    {
        public UpdateExpenseCommandValidator()
        {
            RuleFor(x => x.Category).NotEmpty().WithMessage("Category cannot be null or empty.");
            RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be positive.");
            RuleFor(x => x.Description).NotEmpty().WithMessage("Description cannot be null or empty.");
        }
    }

    /// <summary>Shape checks for approval and rejection — who may decide stays in the controller.</summary>
    public class ApproveExpenseCommandValidator : AbstractValidator<ApproveExpenseCommand>
    {
        public ApproveExpenseCommandValidator()
        {
            RuleFor(x => x.ApprovedBy).NotEmpty().WithMessage("ApprovedBy cannot be null or empty.");
        }
    }

    public class RejectExpenseCommandValidator : AbstractValidator<RejectExpenseCommand>
    {
        public RejectExpenseCommandValidator()
        {
            RuleFor(x => x.RejectedBy).NotEmpty().WithMessage("RejectedBy cannot be null or empty.");
        }
    }
}
