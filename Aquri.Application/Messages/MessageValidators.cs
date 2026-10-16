using FluentValidation;

namespace Aquri.Application.Messages
{
    /// <summary>Shape checks for message creation — sender presence (id or name) is a cross-field rule the handler owns ("Sender is required.").</summary>
    public class CreateMessageCommandValidator : AbstractValidator<CreateMessageCommand>
    {
        public CreateMessageCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.Content).NotEmpty().WithMessage("Content cannot be null or empty.");
        }
    }
}
