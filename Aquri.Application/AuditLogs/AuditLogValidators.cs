using FluentValidation;

namespace Aquri.Application.AuditLogs
{
    /// <summary>Shape checks for audit trail entries — actor fields are stamped by the controller.</summary>
    public class CreateAuditLogCommandValidator : AbstractValidator<CreateAuditLogCommand>
    {
        public CreateAuditLogCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.Action).NotEmpty().WithMessage("Action cannot be null or empty.");
            RuleFor(x => x.EntityType).NotEmpty().WithMessage("EntityType cannot be null or empty.");
            RuleFor(x => x.EntityId).NotEmpty().WithMessage("EntityId cannot be null or empty.");
            RuleFor(x => x.EntityName).NotEmpty().WithMessage("EntityName cannot be null or empty.");
        }
    }
}
