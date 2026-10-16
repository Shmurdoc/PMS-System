using FluentValidation;

namespace Aquri.Application.Bookings
{
    /// <summary>Shape checks for booking creation — overlap and availability stay in the handler.</summary>
    public class CreateBookingCommandValidator : AbstractValidator<CreateBookingCommand>
    {
        public CreateBookingCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.GuestId).GreaterThan(0).WithMessage("GuestId must be positive.");
            RuleFor(x => x.RoomId).GreaterThan(0).WithMessage("RoomId must be positive.");
            RuleFor(x => x.Guests).GreaterThan(0).WithMessage("Guests must be positive.");
            RuleFor(x => x.RatePerNight).GreaterThanOrEqualTo(0).WithMessage("RatePerNight cannot be negative.");
            RuleFor(x => x.Source).NotEmpty().WithMessage("Source cannot be null or empty.");
        }
    }

    /// <summary>Shape checks for status transitions — allowed transitions stay in the handler.</summary>
    public class ChangeBookingStatusCommandValidator : AbstractValidator<ChangeBookingStatusCommand>
    {
        public ChangeBookingStatusCommandValidator()
        {
            RuleFor(x => x.NewStatus).NotEmpty().WithMessage("NewStatus cannot be null or empty.");
        }
    }

    /// <summary>Shape checks for recording a deposit payment against a booking.</summary>
    public class RecordBookingDepositCommandValidator : AbstractValidator<RecordBookingDepositCommand>
    {
        public RecordBookingDepositCommandValidator()
        {
            RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be positive.");
        }
    }
}
