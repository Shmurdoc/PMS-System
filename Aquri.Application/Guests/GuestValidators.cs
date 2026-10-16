using FluentValidation;

namespace Aquri.Application.Guests
{
    /// <summary>Shape checks for guest creation — nothing here depends on database state.</summary>
    public class CreateGuestCommandValidator : AbstractValidator<CreateGuestCommand>
    {
        public CreateGuestCommandValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.");
            RuleFor(x => x.Email).NotEmpty().WithMessage("Email cannot be null or empty.")
                .EmailAddress().WithMessage("Email must be a valid address.");
            RuleFor(x => x.Phone).NotEmpty().WithMessage("Phone cannot be null or empty.");
            RuleFor(x => x.IdNumber).NotEmpty().WithMessage("IdNumber cannot be null or empty.");
            RuleFor(x => x.Nationality).NotEmpty().WithMessage("Nationality cannot be null or empty.");
        }
    }

    /// <summary>Shape checks for guest updates — omitted fields keep their current values.</summary>
    public class UpdateGuestCommandValidator : AbstractValidator<UpdateGuestCommand>
    {
        public UpdateGuestCommandValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.");
            RuleFor(x => x.Phone).NotEmpty().WithMessage("Phone cannot be null or empty.");
            RuleFor(x => x.Nationality).NotEmpty().WithMessage("Nationality cannot be null or empty.");
            RuleFor(x => x.VipLevel).NotEmpty().WithMessage("VipLevel cannot be empty.")
                .When(x => x.VipLevel is not null);
        }
    }
}
