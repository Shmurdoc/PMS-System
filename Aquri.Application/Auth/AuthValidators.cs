using FluentValidation;

namespace Aquri.Application.Auth
{
    /// <summary>
    /// Shape checks for login — credential verification and the timing decoy
    /// stay in the handler, which must see both failure paths.
    /// </summary>
    public class LoginCommandValidator : AbstractValidator<LoginCommand>
    {
        public LoginCommandValidator()
        {
            RuleFor(x => x.Email).NotEmpty().WithMessage("Email cannot be null or empty.")
                .EmailAddress().WithMessage("Email must be a valid address.");
            RuleFor(x => x.Password).NotEmpty().WithMessage("Password cannot be null or empty.");
        }
    }
}
