using FluentValidation;

namespace Aquri.Application.ApiKeys
{
    public class CreateApiKeyValidator : AbstractValidator<CreateApiKeyCommand>
    {
        public CreateApiKeyValidator()
        {
            RuleFor(x => x.Name)
                .NotEmpty().WithMessage("Key name is required.")
                .MaximumLength(200).WithMessage("Key name cannot exceed 200 characters.");

            RuleFor(x => x.ExpiresInDays)
                .GreaterThan(0).When(x => x.ExpiresInDays.HasValue)
                .WithMessage("Expiry must be a positive number of days.");
        }
    }
}
