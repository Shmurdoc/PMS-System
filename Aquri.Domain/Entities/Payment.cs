using System;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Entities
{
    /// <summary>Money received (or attempted) from a guest. Can settle an invoice, a booking deposit, or stand alone. Status moves forward only — a completed payment can be refunded, but never edited in place.</summary>
    public class Payment
    {
        public static readonly string[] ValidMethods =
            { "cash", "card", "eft", "wire_transfer", "mobile_money", "voucher" };

        public int Id { get; private set; }

        /// <summary>Human-readable number, e.g. PAY-2026-00042.</summary>
        public string PaymentNumber { get; private set; } = string.Empty;

        public int? InvoiceId { get; private set; }
        public int? BookingId { get; private set; }
        public int GuestId { get; private set; }
        public int PropertyId { get; private set; }

        public decimal Amount { get; private set; }
        public string Currency { get; private set; } = "ZAR";

        /// <summary>cash | card | eft | wire_transfer | mobile_money | voucher.</summary>
        public string Method { get; private set; } = "card";

        public PaymentStatus Status { get; private set; } = PaymentStatus.Pending;

        /// <summary>Bank or PSP reference shown on statements.</summary>
        public string? Reference { get; private set; }
        public string? IdempotencyKey { get; private set; }
        public string? TransactionId { get; private set; }

        /// <summary>Staff member who keyed the payment in.</summary>
        public string ProcessedBy { get; private set; } = string.Empty;
        public DateTime? ProcessedAt { get; private set; }
        public DateTime Created { get; private set; }

        public Guest? Guest { get; private set; }

        public Payment() { }

        public Payment(
            string paymentNumber, int guestId, int propertyId,
            decimal amount, string method, string processedBy)
        {
            if (string.IsNullOrWhiteSpace(paymentNumber))
                throw new ArgumentException("Payment number cannot be empty.", nameof(paymentNumber));
            if (guestId <= 0)
                throw new ArgumentException("GuestId must be positive.", nameof(guestId));
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (amount <= 0)
                throw new ArgumentException("Amount must be positive.", nameof(amount));
            if (!ValidMethods.Contains(method))
                throw new ArgumentException($"Method must be one of: {string.Join(", ", ValidMethods)}.", nameof(method));
            if (string.IsNullOrWhiteSpace(processedBy))
                throw new ArgumentException("ProcessedBy cannot be empty.", nameof(processedBy));

            PaymentNumber = paymentNumber.Trim();
            GuestId = guestId;
            PropertyId = propertyId;
            Amount = amount;
            Method = method;
            ProcessedBy = processedBy.Trim();
            Status = PaymentStatus.Pending;
            Created = DateTime.UtcNow;
        }

        public void AttachToInvoice(int invoiceId)
        {
            if (invoiceId <= 0)
                throw new ArgumentException("InvoiceId must be positive.", nameof(invoiceId));

            InvoiceId = invoiceId;
        }

        public void DetachFromInvoice()
        {
            InvoiceId = null;
        }

        public void AttachToBooking(int bookingId)
        {
            if (bookingId <= 0)
                throw new ArgumentException("BookingId must be positive.", nameof(bookingId));

            BookingId = bookingId;
        }

        /// <summary>Flags the payment as being handled by the bank/PSP right now.</summary>
        public void MarkProcessing()
        {
            if (Status != PaymentStatus.Pending)
                throw new DomainException($"Only pending payments can start processing (current: {Status.ToWire()}).");

            Status = PaymentStatus.Processing;
        }

        public void Complete(string? transactionId)
        {
            if (Status is not (PaymentStatus.Pending or PaymentStatus.Processing))
                throw new DomainException($"Cannot complete a payment in status '{Status.ToWire()}'.");

            Status = PaymentStatus.Completed;
            TransactionId = transactionId;
            ProcessedAt = DateTime.UtcNow;
        }

        public void Fail()
        {
            if (Status is not (PaymentStatus.Pending or PaymentStatus.Processing))
                throw new DomainException($"Cannot fail a payment in status '{Status.ToWire()}'.");

            Status = PaymentStatus.Failed;
            ProcessedAt = DateTime.UtcNow;
        }

        /// <summary>Refunds a completed payment — the money went back to the guest.</summary>
        public void Refund()
        {
            if (Status != PaymentStatus.Completed)
                throw new DomainException("Only completed payments can be refunded.");

            Status = PaymentStatus.Refunded;
        }

        public void Cancel()
        {
            if (Status is PaymentStatus.Completed or PaymentStatus.Refunded)
                throw new DomainException($"Cannot cancel a payment in status '{Status.ToWire()}'.");

            Status = PaymentStatus.Cancelled;
        }

        public void SetReference(string? reference)
        {
            Reference = reference;
        }

        public void SetIdempotencyKey(string? key)
        {
            if (key is not null && key.Length > 200)
                throw new ArgumentException("Idempotency key cannot exceed 200 characters.", nameof(key));
            IdempotencyKey = key;
        }
    }
}
