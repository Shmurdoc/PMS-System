using System;
using System.Linq;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;

namespace Aquri.Application.Invoices
{
    /// <summary>Invoice line item as returned by the API.</summary>
    public class InvoiceItemDto
    {
        public int Id { get; init; }
        public int InvoiceId { get; init; }
        public string Description { get; init; } = string.Empty;
        public int Quantity { get; init; }
        public decimal UnitPrice { get; init; }
        public decimal TaxRate { get; init; }
        public decimal Amount { get; init; }
        public string Category { get; init; } = string.Empty;

        public static InvoiceItemDto FromEntity(InvoiceItem item) => new()
        {
            Id = item.Id,
            InvoiceId = item.InvoiceId,
            Description = item.Description,
            Quantity = item.Quantity,
            UnitPrice = item.UnitPrice,
            TaxRate = item.TaxRate,
            Amount = item.Amount,
            Category = item.Category
        };
    }

    /// <summary>Invoice with nested line items.</summary>
    public class InvoiceDto
    {
        public int Id { get; init; }
        public string InvoiceNumber { get; init; } = string.Empty;
        public string Type { get; init; } = string.Empty;
        public int? BookingId { get; init; }
        public int GuestId { get; init; }
        public string? GuestName { get; init; }
        public int PropertyId { get; init; }
        public InvoiceItemDto[] Items { get; init; } = Array.Empty<InvoiceItemDto>();
        public decimal Subtotal { get; init; }
        public decimal TaxAmount { get; init; }
        public decimal DiscountAmount { get; init; }
        public decimal Total { get; init; }
        public string Currency { get; init; } = "ZAR";
        public string Status { get; init; } = string.Empty;
        public DateTime IssueDate { get; init; }
        public DateTime DueDate { get; init; }
        public DateTime? PaidDate { get; init; }
        public decimal PaidAmount { get; init; }
        public string? PaymentMethod { get; init; }
        public string? Notes { get; init; }
        public string CreatedBy { get; init; } = string.Empty;

        public static InvoiceDto FromEntity(Invoice invoice) => new()
        {
            Id = invoice.Id,
            InvoiceNumber = invoice.InvoiceNumber,
            Type = invoice.Type.ToWire(),
            BookingId = invoice.BookingId,
            GuestId = invoice.GuestId,
            GuestName = invoice.Guest?.Name,
            PropertyId = invoice.PropertyId,
            Items = invoice.Items.Select(InvoiceItemDto.FromEntity).ToArray(),
            Subtotal = invoice.Subtotal,
            TaxAmount = invoice.TaxAmount,
            DiscountAmount = invoice.DiscountAmount,
            Total = invoice.Total,
            Currency = invoice.Currency,
            Status = invoice.Status.ToWire(),
            IssueDate = invoice.IssueDate,
            DueDate = invoice.DueDate,
            PaidDate = invoice.PaidDate,
            PaidAmount = invoice.PaidAmount,
            PaymentMethod = invoice.PaymentMethod,
            Notes = invoice.Notes,
            CreatedBy = invoice.CreatedBy
        };
    }
}
