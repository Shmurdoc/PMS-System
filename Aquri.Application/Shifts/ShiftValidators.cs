using FluentValidation;

namespace Aquri.Application.Shifts
{
    /// <summary>Shape checks for shift creation — roster conflicts stay in the handler.</summary>
    public class CreateShiftCommandValidator : AbstractValidator<CreateShiftCommand>
    {
        public CreateShiftCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.UserId).GreaterThan(0).WithMessage("UserId must be positive.");
            RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName cannot be null or empty.");
            RuleFor(x => x.Role).NotEmpty().WithMessage("Role cannot be null or empty.");
        }
    }

    /// <summary>Shape checks for status changes and staff swaps — allowed values stay in the handler.</summary>
    public class ChangeShiftStatusCommandValidator : AbstractValidator<ChangeShiftStatusCommand>
    {
        public ChangeShiftStatusCommandValidator()
        {
            RuleFor(x => x.Status).NotEmpty().WithMessage("Status cannot be null or empty.");
        }
    }

    public class SwapShiftCommandValidator : AbstractValidator<SwapShiftCommand>
    {
        public SwapShiftCommandValidator()
        {
            RuleFor(x => x.NewStaffName).NotEmpty().WithMessage("NewStaffName cannot be null or empty.");
        }
    }

    // UpdateShiftCommand carries only optional fields (sparse edit), so no validator.
}
