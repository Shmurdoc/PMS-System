using FluentValidation;

namespace Aquri.Application.Integrations
{
    /// <summary>
    /// Shape checks for integration creation — the status vocabulary
    /// (connected/disconnected/error/syncing) lives in the domain entity, not
    /// here. Edits are sparse (all fields optional, empty-means-omit) so they
    /// carry no shape validator; sync is id-only.
    /// </summary>
    public class CreateIntegrationCommandValidator : AbstractValidator<CreateIntegrationCommand>
    {
        public CreateIntegrationCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.");
            RuleFor(x => x.Category).NotEmpty().WithMessage("Category cannot be null or empty.");
        }
    }
}
