using FluentValidation;

namespace Aquri.Application.Inventory
{
    /// <summary>Shape checks for inventory creation — stock math stays in the handlers.</summary>
    public class CreateInventoryItemCommandValidator : AbstractValidator<CreateInventoryItemCommand>
    {
        public CreateInventoryItemCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.");
            RuleFor(x => x.Category).NotEmpty().WithMessage("Category cannot be null or empty.");
            RuleFor(x => x.Unit).NotEmpty().WithMessage("Unit cannot be null or empty.");
            RuleFor(x => x.Quantity).GreaterThanOrEqualTo(0).WithMessage("Quantity cannot be negative.");
            RuleFor(x => x.ReorderLevel).GreaterThanOrEqualTo(0).WithMessage("ReorderLevel cannot be negative.");
            RuleFor(x => x.Price).GreaterThanOrEqualTo(0).WithMessage("Price cannot be negative.");
            RuleFor(x => x.MinOrderQuantity).GreaterThanOrEqualTo(0).WithMessage("MinOrderQuantity cannot be negative.")
                .When(x => x.MinOrderQuantity.HasValue);
        }
    }

    /// <summary>Shape checks for sparse inventory updates — omitted fields keep their current values.</summary>
    public class UpdateInventoryItemCommandValidator : AbstractValidator<UpdateInventoryItemCommand>
    {
        public UpdateInventoryItemCommandValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be null or empty.")
                .When(x => x.Name is not null);
            RuleFor(x => x.ReorderLevel).GreaterThanOrEqualTo(0).WithMessage("ReorderLevel cannot be negative.")
                .When(x => x.ReorderLevel.HasValue);
            RuleFor(x => x.Price).GreaterThanOrEqualTo(0).WithMessage("Price cannot be negative.")
                .When(x => x.Price.HasValue);
            RuleFor(x => x.MinOrderQuantity).GreaterThanOrEqualTo(0).WithMessage("MinOrderQuantity cannot be negative.")
                .When(x => x.MinOrderQuantity.HasValue);
        }
    }

    /// <summary>Shape checks for restocking — the quantity added must be a real amount.</summary>
    public class RestockInventoryItemCommandValidator : AbstractValidator<RestockInventoryItemCommand>
    {
        public RestockInventoryItemCommandValidator()
        {
            RuleFor(x => x.QuantityAdded).GreaterThan(0).WithMessage("QuantityAdded must be positive.");
        }
    }

    // AdjustInventoryQuantityCommand carries no shape to check: Delta is legitimately
    // negative for consumption and non-zero by handler rule, so no validator is registered.
}
