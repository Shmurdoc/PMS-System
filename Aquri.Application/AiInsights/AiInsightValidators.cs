using FluentValidation;

namespace Aquri.Application.AiInsights
{
    /// <summary>
    /// Shape checks for insight creation — type vocabulary stays in the handler,
    /// which owns AiInsight.ValidTypes.
    /// </summary>
    public class CreateAiInsightCommandValidator : AbstractValidator<CreateAiInsightCommand>
    {
        public CreateAiInsightCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive when specified.")
                .When(x => x.PropertyId.HasValue);
            RuleFor(x => x.Type).NotEmpty().WithMessage("Type cannot be null or empty.");
            RuleFor(x => x.Title).NotEmpty().WithMessage("Title cannot be null or empty.");
            RuleFor(x => x.Impact).NotEmpty().WithMessage("Impact cannot be null or empty.");
        }
    }

    // UpdateAiInsightCommand carries only optional fields (sparse edit), so no validator.
}
