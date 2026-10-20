using FluentValidation;

namespace Aquri.Application.Rooms.Commands
{
    /// <summary>Shape checks for room creation — number uniqueness stays in the handler.</summary>
    public class CreateRoomCommandValidator : AbstractValidator<CreateRoomCommand>
    {
        public CreateRoomCommandValidator()
        {
            RuleFor(x => x.Number).NotEmpty().WithMessage("Number cannot be null or empty.");
            RuleFor(x => x.Type).NotEmpty().WithMessage("Type cannot be null or empty.");
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.Price).GreaterThanOrEqualTo(0).WithMessage("Price cannot be negative.");
            RuleFor(x => x.MaxOccupancy).GreaterThan(0).WithMessage("MaxOccupancy must be positive.");
            RuleFor(x => x.Size).GreaterThan(0).WithMessage("Size must be positive.")
                .When(x => x.Size.HasValue);
        }
    }

    /// <summary>Shape checks for single-field room updates; vocabulary checks stay in handlers.</summary>
    public class UpdateRoomStatusCommandValidator : AbstractValidator<UpdateRoomStatusCommand>
    {
        public UpdateRoomStatusCommandValidator()
        {
            RuleFor(x => x.Status).NotEmpty().WithMessage("Status cannot be null or empty.");
        }
    }

    public class UpdateRoomPriceCommandValidator : AbstractValidator<UpdateRoomPriceCommand>
    {
        public UpdateRoomPriceCommandValidator()
        {
            RuleFor(x => x.Price).GreaterThanOrEqualTo(0).WithMessage("Price cannot be negative.");
        }
    }

    public class UpdateRoomMaxOccupancyCommandValidator : AbstractValidator<UpdateRoomMaxOccupancyCommand>
    {
        public UpdateRoomMaxOccupancyCommandValidator()
        {
            RuleFor(x => x.MaxOccupancy).GreaterThan(0).WithMessage("MaxOccupancy must be positive.");
        }
    }

    public class UpdateRoomAmenitiesCommandValidator : AbstractValidator<UpdateRoomAmenitiesCommand>
    {
        public UpdateRoomAmenitiesCommandValidator()
        {
            RuleFor(x => x.Action).NotEmpty().WithMessage("Action cannot be null or empty.");
            RuleFor(x => x.Amenity).NotEmpty().WithMessage("Amenity cannot be null or empty.");
        }
    }

    public class UpdateRoomViewCommandValidator : AbstractValidator<UpdateRoomViewCommand>
    {
        public UpdateRoomViewCommandValidator()
        {
            RuleFor(x => x.View).NotEmpty().WithMessage("View cannot be null or empty.");
        }
    }
}
