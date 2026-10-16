using FluentValidation;

namespace Aquri.Application.Tickets
{
    /// <summary>Shape checks for ticket creation — workflow rules stay in the domain entity.</summary>
    public class CreateTicketCommandValidator : AbstractValidator<CreateTicketCommand>
    {
        public CreateTicketCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.ReporterId).GreaterThan(0).WithMessage("ReporterId must be positive.");
            RuleFor(x => x.Title).NotEmpty().WithMessage("Title cannot be null or empty.");
            RuleFor(x => x.Description).NotEmpty().WithMessage("Description cannot be null or empty.");
            RuleFor(x => x.Type).NotEmpty().WithMessage("Type cannot be null or empty.");
            RuleFor(x => x.Category).NotEmpty().WithMessage("Category cannot be null or empty.");
            RuleFor(x => x.Priority).NotEmpty().WithMessage("Priority cannot be null or empty.");
            RuleFor(x => x.Tags).NotNull().WithMessage("Tags cannot be null.");
        }
    }

    /// <summary>Shape checks for status transitions — allowed transitions stay in the domain entity.</summary>
    public class ChangeTicketStatusCommandValidator : AbstractValidator<ChangeTicketStatusCommand>
    {
        public ChangeTicketStatusCommandValidator()
        {
            RuleFor(x => x.NewStatus).NotEmpty().WithMessage("NewStatus cannot be null or empty.");
        }
    }

    /// <summary>Shape checks for adding a comment to a ticket thread.</summary>
    public class AddTicketCommentCommandValidator : AbstractValidator<AddTicketCommentCommand>
    {
        public AddTicketCommentCommandValidator()
        {
            RuleFor(x => x.UserId).GreaterThan(0).WithMessage("UserId must be positive.");
            RuleFor(x => x.Content).NotEmpty().WithMessage("Content cannot be null or empty.");
        }
    }
}
