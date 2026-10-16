using FluentValidation;

namespace Aquri.Application.TaxConfigs
{
    /// <summary>Shape checks for tax rule creation — deactivation rules stay in the domain entity.</summary>
    public class CreateTaxConfigCommandValidator : AbstractValidator<CreateTaxConfigCommand>
    {
        public CreateTaxConfigCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.");
            RuleFor(x => x.Type).NotEmpty().WithMessage("Type cannot be null or empty.");
            RuleFor(x => x.Rate).GreaterThanOrEqualTo(0).WithMessage("Rate cannot be negative.");
        }
    }

    /// <summary>Shape checks for sparse tax rule updates — deactivation semantics stay in the handler.</summary>
    public class UpdateTaxConfigCommandValidator : AbstractValidator<UpdateTaxConfigCommand>
    {
        public UpdateTaxConfigCommandValidator()
        {
            RuleFor(x => x.Rate).GreaterThanOrEqualTo(0).WithMessage("Rate cannot be negative.")
                .When(x => x.Rate.HasValue);
        }
    }
}
