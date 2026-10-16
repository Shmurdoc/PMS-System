using FluentValidation;

namespace Aquri.Application.Users
{
    /// <summary>Shape checks for user creation — uniqueness and role policy stay in the handler.</summary>
    public class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
    {
        public CreateUserCommandValidator()
        {
            RuleFor(x => x.Email).NotEmpty().WithMessage("Email cannot be null or empty.")
                .EmailAddress().WithMessage("Email must be a valid address.");
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.");
            RuleFor(x => x.Password).NotEmpty().WithMessage("Password cannot be null or empty.")
                .MinimumLength(UserRules.MinPasswordLength)
                .WithMessage($"Password must be at least {UserRules.MinPasswordLength} characters.");
            RuleFor(x => x.Role).NotEmpty().WithMessage("Role cannot be null or empty.");
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.")
                .When(x => x.PropertyId.HasValue);
        }
    }

    /// <summary>Shape checks for user updates — omitted fields keep their current values.</summary>
    public class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
    {
        public UpdateUserCommandValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.");
            RuleFor(x => x.Password)
                .MinimumLength(UserRules.MinPasswordLength)
                .WithMessage($"Password must be at least {UserRules.MinPasswordLength} characters.")
                .When(x => !string.IsNullOrEmpty(x.Password));
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.")
                .When(x => x.PropertyId.HasValue);
        }
    }
}
