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

        public CreateInvoiceHandler(IApplicationDbContext context, INumberGenerator numbers)
        {
            _context = context;
            _numbers = numbers;
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

            var invoiceNumber = await _numbers.NextInvoiceNumberAsync(cancellationToken);

            try
            {
                var invoice = new Invoice(invoiceNumber, request.GuestId, request.PropertyId,
                    request.DueDate, request.CreatedBy);

                invoice.SetType(type);
                if (request.BookingId.HasValue)
                    invoice.AttachToBooking(request.BookingId.Value);
                if (request.DiscountAmount > 0)
                    invoice.ApplyDiscount(request.DiscountAmount);
                invoice.SetNotes(request.Notes);

                foreach (var input in request.Items)
                    invoice.AddItem(new InvoiceItem(input.Description, input.Quantity, input.UnitPrice, input.TaxRate, input.Category));

                _context.Invoices.Add(invoice);
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

            try
            {
                invoice.AddItem(new InvoiceItem(request.Description, request.Quantity, request.UnitPrice, request.TaxRate, request.Category));
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
