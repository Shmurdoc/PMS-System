using FluentValidation;

namespace Aquri.Application.Payments
{
    /// <summary>Shape checks for payment creation — invoice/booking linkage stays in the handler.</summary>
    public class CreatePaymentCommandValidator : AbstractValidator<CreatePaymentCommand>
    {
        public CreatePaymentCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.GuestId).GreaterThan(0).WithMessage("GuestId must be positive.");
            RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be positive.");
            RuleFor(x => x.Method).NotEmpty().WithMessage("Method cannot be null or empty.");
            RuleFor(x => x.ProcessedBy).NotEmpty().WithMessage("ProcessedBy cannot be null or empty.");
        }
    }
}
