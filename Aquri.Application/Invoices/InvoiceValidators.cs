using FluentValidation;

namespace Aquri.Application.Invoices
{
    /// <summary>Shape checks for invoice creation — totals are computed server-side in the handler.</summary>
    public class CreateInvoiceCommandValidator : AbstractValidator<CreateInvoiceCommand>
    {
        public CreateInvoiceCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.GuestId).GreaterThan(0).WithMessage("GuestId must be positive.");
            RuleFor(x => x.Type).NotEmpty().WithMessage("Type cannot be null or empty.");
            RuleFor(x => x.DiscountAmount).GreaterThanOrEqualTo(0).WithMessage("DiscountAmount cannot be negative.");
            RuleFor(x => x.CreatedBy).NotEmpty().WithMessage("CreatedBy cannot be null or empty.");
            RuleFor(x => x.Items).NotNull().WithMessage("Items cannot be null.")
                .Must(items => items.Count > 0).WithMessage("An invoice needs at least one line item.");
            RuleForEach(x => x.Items).ChildRules(item =>
            {
                item.RuleFor(i => i.Description).NotEmpty().WithMessage("Item description cannot be null or empty.");
                item.RuleFor(i => i.Quantity).GreaterThan(0).WithMessage("Item quantity must be positive.");
                item.RuleFor(i => i.UnitPrice).GreaterThanOrEqualTo(0).WithMessage("Item unit price cannot be negative.");
                item.RuleFor(i => i.TaxRate).GreaterThanOrEqualTo(0).WithMessage("Item tax rate cannot be negative.");
                item.RuleFor(i => i.Category).NotEmpty().WithMessage("Item category cannot be null or empty.");
            });
        }
    }

    /// <summary>Shape checks for appending a line item to an existing invoice.</summary>
    public class AddInvoiceItemCommandValidator : AbstractValidator<AddInvoiceItemCommand>
    {
        public AddInvoiceItemCommandValidator()
        {
            RuleFor(x => x.InvoiceId).GreaterThan(0).WithMessage("InvoiceId must be positive.");
            RuleFor(x => x.Description).NotEmpty().WithMessage("Description cannot be null or empty.");
            RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("Quantity must be positive.");
            RuleFor(x => x.UnitPrice).GreaterThanOrEqualTo(0).WithMessage("UnitPrice cannot be negative.");
            RuleFor(x => x.TaxRate).GreaterThanOrEqualTo(0).WithMessage("TaxRate cannot be negative.");
            RuleFor(x => x.Category).NotEmpty().WithMessage("Category cannot be null or empty.");
        }
    }

    /// <summary>Shape checks for recording a payment against an invoice.</summary>
    public class RecordInvoicePaymentCommandValidator : AbstractValidator<RecordInvoicePaymentCommand>
    {
        public RecordInvoicePaymentCommandValidator()
        {
            RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be positive.");
            RuleFor(x => x.PaymentMethod).NotEmpty().WithMessage("PaymentMethod cannot be null or empty.");
        }
    }
}
