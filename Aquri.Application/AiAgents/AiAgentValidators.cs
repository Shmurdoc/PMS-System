using FluentValidation;

namespace Aquri.Application.AiAgents
{
    /// <summary>Shape checks for agent lifecycle commands — vocabulary checks stay in the handler.</summary>
    public class UpdateAgentStatusCommandValidator : AbstractValidator<UpdateAgentStatusCommand>
    {
        public UpdateAgentStatusCommandValidator()
        {
            RuleFor(x => x.Status).NotEmpty().WithMessage("Status cannot be null or empty.");
        }
    }
}
