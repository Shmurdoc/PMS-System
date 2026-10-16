using FluentValidation;

namespace Aquri.Application.AiWorkflows
{
    /// <summary>Shape checks for workflow creation — trigger/action semantics stay in the handler.</summary>
    public class CreateWorkflowCommandValidator : AbstractValidator<CreateWorkflowCommand>
    {
        public CreateWorkflowCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive when specified.")
                .When(x => x.PropertyId.HasValue);
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.");
            RuleFor(x => x.Trigger).NotEmpty().WithMessage("Trigger cannot be null or empty.");
            RuleFor(x => x.Actions).NotNull().WithMessage("Actions cannot be null.")
                .Must(actions => actions.Length > 0).WithMessage("A workflow needs at least one action.");
        }
    }

    /// <summary>Shape checks for sparse workflow updates — omitted fields keep their current values.</summary>
    public class UpdateWorkflowCommandValidator : AbstractValidator<UpdateWorkflowCommand>
    {
        public UpdateWorkflowCommandValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.")
                .When(x => x.Name is not null);
            RuleFor(x => x.Trigger).NotEmpty().WithMessage("Trigger cannot be null or empty.")
                .When(x => x.Trigger is not null);
            RuleFor(x => x.Actions).Must(actions => actions is { Length: > 0 })
                .WithMessage("A workflow needs at least one action.")
                .When(x => x.Actions is not null);
        }
    }
}
