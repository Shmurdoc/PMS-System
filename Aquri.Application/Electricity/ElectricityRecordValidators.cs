using FluentValidation;

namespace Aquri.Application.Electricity
{
    /// <summary>
    /// Shape checks for meter-reading creation. Negative readings are rejected
    /// here and again in the domain entity — the validator fails fast with the
    /// VALIDATION envelope before the handler runs. Edits are sparse (all
    /// fields optional, empty-means-omit) so they carry no shape validator.
    /// </summary>
    public class CreateElectricityRecordCommandValidator : AbstractValidator<CreateElectricityRecordCommand>
    {
        public CreateElectricityRecordCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.Consumption).GreaterThanOrEqualTo(0).WithMessage("Consumption cannot be negative.");
            RuleFor(x => x.Cost).GreaterThanOrEqualTo(0).WithMessage("Cost cannot be negative.");
            RuleFor(x => x.PeakDemand).GreaterThanOrEqualTo(0).WithMessage("PeakDemand cannot be negative.");
        }
    }
}
