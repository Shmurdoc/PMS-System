using System;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;

namespace Aquri.Application.Payments
{
    /// <summary>Payment as returned by the API.</summary>
    public class PaymentDto
    {
        public int Id { get; init; }
        public string PaymentNumber { get; init; } = string.Empty;
        public int? InvoiceId { get; init; }
        public int? BookingId { get; init; }
        public int GuestId { get; init; }
        public string? GuestName { get; init; }
        public int PropertyId { get; init; }
        public decimal Amount { get; init; }
        public string Currency { get; init; } = "ZAR";
        public string Method { get; init; } = string.Empty;
        public string Status { get; init; } = string.Empty;
        public string? Reference { get; init; }
        public string? TransactionId { get; init; }
        public string ProcessedBy { get; init; } = string.Empty;
        public DateTime? ProcessedAt { get; init; }
        public DateTime Created { get; init; }

        public static PaymentDto FromEntity(Payment payment) => new()
        {
            Id = payment.Id,
            PaymentNumber = payment.PaymentNumber,
            InvoiceId = payment.InvoiceId,
            BookingId = payment.BookingId,
            GuestId = payment.GuestId,
            GuestName = payment.Guest?.Name,
            PropertyId = payment.PropertyId,
            Amount = payment.Amount,
            Currency = payment.Currency,
            Method = payment.Method,
            Status = payment.Status.ToWire(),
            Reference = payment.Reference,
            TransactionId = payment.TransactionId,
            ProcessedBy = payment.ProcessedBy,
            ProcessedAt = payment.ProcessedAt,
            Created = payment.Created
        };
    }
}
