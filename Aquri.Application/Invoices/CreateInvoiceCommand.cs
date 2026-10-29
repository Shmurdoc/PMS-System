using System;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Invoices
{
    /// <summary>Line item supplied when creating or adding to an invoice.</summary>
    public record InvoiceItemInput(string Description, int Quantity, decimal UnitPrice, decimal TaxRate, string Category);

    /// <summary>Creates a tax invoice with its line items; totals are computed server-side.</summary>
    public record CreateInvoiceCommand(
        int PropertyId,
        int GuestId,
        int? BookingId,
        string Type,
        DateTime DueDate,
        decimal DiscountAmount,
        string Notes,
        List<InvoiceItemInput> Items,
        string CreatedBy) : IRequest<Result<InvoiceDto>>;

    public class CreateInvoiceHandler : IRequestHandler<CreateInvoiceCommand, Result<InvoiceDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly INumberGenerator _numbers;
        private readonly ICurrentUser _currentUser;

        public CreateInvoiceHandler(IApplicationDbContext context, INumberGenerator numbers, ICurrentUser currentUser)
        {
            _context = context;
            _numbers = numbers;
            _currentUser = currentUser;
        }

        public async Task<Result<InvoiceDto>> Handle(CreateInvoiceCommand request, CancellationToken cancellationToken)
        {
            if (request.Items is null || request.Items.Count == 0)
                return Result<InvoiceDto>.Failure("An invoice needs at least one line item.");

            if (!InvoiceTypeExtensions.TryParseWire(request.Type, out var type))
                return Result<InvoiceDto>.Failure($"Unknown invoice type '{request.Type}'.");

            var guest = await _context.Guests.FindAsync(request.GuestId);
            if (guest is null)
                return Result<InvoiceDto>.Failure("Guest not found.");

            // BookingId is a client-supplied FK — verify it exists and belongs to
            // the same property before stamping it onto the invoice.
            if (request.BookingId.HasValue)
            {
                var booking = await _context.Bookings.FindAsync(request.BookingId.Value);
                if (booking is null)
                    return Result<InvoiceDto>.Failure("Booking not found.");
                if (booking.PropertyId != request.PropertyId)
                    return Result<InvoiceDto>.Failure("Booking does not belong to the specified property.");
            }

            var property = await _context.Properties
                .FirstOrDefaultAsync(p => p.PropertyId == request.PropertyId, cancellationToken);
            if (property is null)
                return Result<InvoiceDto>.Failure("Property not found.");

            // Tax rates are server-derived from the property's TaxConfig rules
            // (roadmap: "tax rules live in the TaxConfig entity rather than being
            // hardcoded"). The client-sent rate is only used as a fallback when no
            // rule covers the line, so unconfigured properties behave as before.
            var now = DateTime.UtcNow;
            var taxRules = await _context.TaxConfigs
                .Where(t => t.PropertyId == request.PropertyId && t.Active && !t.Included)
                .ToListAsync(cancellationToken);

            var invoiceNumber = await _numbers.NextInvoiceNumberAsync(cancellationToken);

            try
            {
                var invoice = new Invoice(invoiceNumber, request.GuestId, request.PropertyId,
                    request.DueDate, request.CreatedBy);

                invoice.SetType(type);
                invoice.SetCurrency(property.Currency);
                if (request.BookingId.HasValue)
                    invoice.AttachToBooking(request.BookingId.Value);
                if (request.DiscountAmount > 0)
                    invoice.ApplyDiscount(request.DiscountAmount);
                invoice.SetNotes(request.Notes);

                foreach (var input in request.Items)
                {
                    var rate = InvoiceTaxResolver.ResolveLineTaxRate(taxRules, now, input.Category, input.TaxRate);
                    invoice.AddItem(new InvoiceItem(input.Description, input.Quantity, input.UnitPrice, rate, input.Category));
                }

                _context.Invoices.Add(invoice);
                await _context.SaveChangesAsync(cancellationToken);

                AuditTrail.Write(_context, _currentUser, "create_invoice", "invoice", invoice.Id.ToString(), invoice.InvoiceNumber);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<InvoiceDto>.SuccessResult(InvoiceDto.FromEntity(invoice));
            }
            catch (DomainException ex)
            {
                return Result<InvoiceDto>.Failure(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return Result<InvoiceDto>.Failure(ex.Message);
            }
        }
    }

    /// <summary>Resolves the effective line tax rate from a property's TaxConfig rules. Percentage taxes (vat, sales_tax, tourism_levy, city_tax) that apply to the line's category are summed; service charges and price-included (Included) rules are excluded. When no rule covers the line the client-sent rate is honoured, so properties without configured taxes keep existing behaviour.</summary>
    internal static class InvoiceTaxResolver
    {
        public static decimal ResolveLineTaxRate(
            IReadOnlyList<TaxConfig> rules, DateTime date, string category, decimal clientRate)
        {
            var applicable = rules
                .Where(t => t.AppliesOn(date)
                    && t.Type != "service_charge"
                    && (t.ApplicableTo.Length == 0 ||
                        t.ApplicableTo.Any(a => string.Equals(a, category, StringComparison.OrdinalIgnoreCase))))
                .ToList();

            if (applicable.Count == 0)
                return clientRate;

            return Math.Min(applicable.Sum(t => t.Rate), 1m);
        }
    }

    /// <summary>Adds a single line item to an existing draft invoice; totals recompute.</summary>
    public record AddInvoiceItemCommand(
        int InvoiceId,
        string Description,
        int Quantity,
        decimal UnitPrice,
        decimal TaxRate,
        string Category) : IRequest<Result<InvoiceDto>>;

    public class AddInvoiceItemHandler : IRequestHandler<AddInvoiceItemCommand, Result<InvoiceDto>>
    {
        private readonly IApplicationDbContext _context;

        public AddInvoiceItemHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<InvoiceDto>> Handle(AddInvoiceItemCommand request, CancellationToken cancellationToken)
        {
            var invoice = await _context.Invoices
                .Include(i => i.Items)
                .FirstOrDefaultAsync(i => i.Id == request.InvoiceId, cancellationToken);

            if (invoice is null)
                return Result<InvoiceDto>.NotFoundResult();

            if (invoice.Status is not (InvoiceStatus.Draft or InvoiceStatus.Sent))
                return Result<InvoiceDto>.Failure("Items can only be added to draft or sent invoices.");

            // Same server-side tax resolution as invoice creation.
            var now = DateTime.UtcNow;
            var taxRules = await _context.TaxConfigs
                .Where(t => t.PropertyId == invoice.PropertyId && t.Active && !t.Included)
                .ToListAsync(cancellationToken);
            var rate = InvoiceTaxResolver.ResolveLineTaxRate(taxRules, now, request.Category, request.TaxRate);

            try
            {
                invoice.AddItem(new InvoiceItem(request.Description, request.Quantity, request.UnitPrice, rate, request.Category));
                await _context.SaveChangesAsync(cancellationToken);
                return Result<InvoiceDto>.SuccessResult(InvoiceDto.FromEntity(invoice));
            }
            catch (DomainException ex)
            {
                return Result<InvoiceDto>.Failure(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return Result<InvoiceDto>.Failure(ex.Message);
            }
        }
    }
}
