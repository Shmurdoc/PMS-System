using FluentValidation;

namespace Aquri.Application.AiChat
{
    /// <summary>Shape checks for chat — the configured client stays in the handler.</summary>
    public class SendChatCommandValidator : AbstractValidator<SendChatCommand>
    {
        public SendChatCommandValidator()
        {
            RuleFor(x => x.Message).NotEmpty().WithMessage("Message cannot be empty.");
        }
    }
}
