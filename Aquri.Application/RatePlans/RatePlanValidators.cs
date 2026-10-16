using FluentValidation;

namespace Aquri.Application.RatePlans
{
    /// <summary>Shape checks for rate plan creation — season conflicts stay in the handler.</summary>
    public class CreateRatePlanCommandValidator : AbstractValidator<CreateRatePlanCommand>
    {
        public CreateRatePlanCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.");
            RuleFor(x => x.Season).NotEmpty().WithMessage("Season cannot be null or empty.");
            RuleFor(x => x.BaseRate).GreaterThanOrEqualTo(0).WithMessage("BaseRate cannot be negative.");
            RuleFor(x => x.MinStay).GreaterThanOrEqualTo(0).WithMessage("MinStay cannot be negative.");
        }
    }

    /// <summary>Shape checks for sparse rate plan updates — omitted fields keep their current values.</summary>
    public class UpdateRatePlanCommandValidator : AbstractValidator<UpdateRatePlanCommand>
    {
        public UpdateRatePlanCommandValidator()
        {
            RuleFor(x => x.BaseRate).GreaterThanOrEqualTo(0).WithMessage("BaseRate cannot be negative.")
                .When(x => x.BaseRate.HasValue);
        }
    }
}
