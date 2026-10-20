using FluentValidation;

namespace Aquri.Application.Properties.Commands
{
    /// <summary>Shape checks for the one-shot property + rooms creation path.</summary>
    public class CreatePropertyWithRoomsCommandValidator : AbstractValidator<CreatePropertyWithRoomsCommand>
    {
        public CreatePropertyWithRoomsCommandValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.");
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            // Empty arrays are legal — the handler creates a room-less property
            RuleFor(x => x.InitialRooms).NotNull().WithMessage("InitialRooms cannot be null.");
            RuleForEach(x => x.InitialRooms).ChildRules(room =>
            {
                room.RuleFor(r => r.Number).NotEmpty().WithMessage("Room number cannot be null or empty.");
                room.RuleFor(r => r.Type).NotEmpty().WithMessage("Room type cannot be null or empty.");
                room.RuleFor(r => r.Price).GreaterThanOrEqualTo(0).WithMessage("Room price cannot be negative.");
                room.RuleFor(r => r.MaxOccupancy).GreaterThan(0).WithMessage("MaxOccupancy must be positive.");
            });
        }
    }

    /// <summary>Shape checks for updating a property's editable descriptive fields.</summary>
    public class UpdatePropertyDetailsCommandValidator : AbstractValidator<UpdatePropertyDetailsCommand>
    {
        public UpdatePropertyDetailsCommandValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.");
            RuleFor(x => x.Rating).InclusiveBetween(0, 5).WithMessage("Rating must be between 0 and 5.");
        }
    }
}
