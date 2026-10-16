using FluentValidation;

namespace Aquri.Application.RfidTags
{
    /// <summary>Shape checks for tag issuance — binding rules (staff vs guest) stay in the handler.</summary>
    public class IssueRfidTagCommandValidator : AbstractValidator<IssueRfidTagCommand>
    {
        public IssueRfidTagCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.Kind).NotEmpty().WithMessage("Kind cannot be null or empty.");
            RuleFor(x => x.TagNumber).NotEmpty().WithMessage("TagNumber cannot be null or empty.");
        }
    }

    /// <summary>Shape checks for tap endpoints — tag lookup failures stay in the handlers.</summary>
    public class RecordStaffTapCommandValidator : AbstractValidator<RecordStaffTapCommand>
    {
        public RecordStaffTapCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.TagNumber).NotEmpty().WithMessage("TagNumber cannot be null or empty.");
        }
    }

    public class ResolveGuestTapCommandValidator : AbstractValidator<ResolveGuestTapCommand>
    {
        public ResolveGuestTapCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.TagNumber).NotEmpty().WithMessage("TagNumber cannot be null or empty.");
        }
    }
}
