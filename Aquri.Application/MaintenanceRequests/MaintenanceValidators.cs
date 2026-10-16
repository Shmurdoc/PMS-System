using FluentValidation;

namespace Aquri.Application.MaintenanceRequests
{
    /// <summary>Shape checks for maintenance creation — status and priority vocabulary checks stay in the handler, which owns MaintenanceRequestVocabulary.</summary>
    public class CreateMaintenanceRequestCommandValidator : AbstractValidator<CreateMaintenanceRequestCommand>
    {
        public CreateMaintenanceRequestCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.Description).NotEmpty().WithMessage("Description cannot be null or empty.");
        }
    }

    // UpdateMaintenanceRequestCommand carries only optional fields — every value is
    // validated by the handler against the status/priority vocabulary, so no validator.
}
