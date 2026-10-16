using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Entities
{
    /// <summary>A bill issued to a guest. Totals are recalculated from line items and the discount whenever something changes — handlers never set Subtotal/Total by hand, so the numbers on screen always match the lines.</summary>
    public class Invoice
    {
        private static readonly IReadOnlyDictionary<InvoiceStatus, InvoiceStatus[]> AllowedTransitions =
            new ReadOnlyDictionary<InvoiceStatus, InvoiceStatus[]>(new Dictionary<InvoiceStatus, InvoiceStatus[]>
            {
                [InvoiceStatus.Draft]    = new[] { InvoiceStatus.Pending, InvoiceStatus.Sent, InvoiceStatus.Cancelled },
                [InvoiceStatus.Pending]  = new[] { InvoiceStatus.Sent, InvoiceStatus.Paid, InvoiceStatus.Partial, InvoiceStatus.Overdue, InvoiceStatus.Cancelled },
                [InvoiceStatus.Sent]     = new[] { InvoiceStatus.Paid, InvoiceStatus.Partial, InvoiceStatus.Overdue, InvoiceStatus.Cancelled },
                [InvoiceStatus.Partial]  = new[] { InvoiceStatus.Paid, InvoiceStatus.Overdue, InvoiceStatus.Cancelled },
                [InvoiceStatus.Overdue]  = new[] { InvoiceStatus.Paid, InvoiceStatus.Partial, InvoiceStatus.Cancelled },
                [InvoiceStatus.Paid]     = new[] { InvoiceStatus.Refunded },
                [InvoiceStatus.Cancelled] = Array.Empty<InvoiceStatus>(),
                [InvoiceStatus.Refunded] = Array.Empty<InvoiceStatus>(),
            });

        private readonly List<InvoiceItem> _items = new();

        public int Id { get; private set; }

        /// <summary>Human-readable number, e.g. INV-2026-00042.</summary>
        public string InvoiceNumber { get; private set; } = string.Empty;

        /// <summary>booking | service | advance | final.</summary>
        public InvoiceType Type { get; private set; } = InvoiceType.Booking;

        public int? BookingId { get; private set; }
        public int GuestId { get; private set; }
        public int PropertyId { get; private set; }

        public IReadOnlyCollection<InvoiceItem> Items => _items;

        public decimal Subtotal { get; private set; }
        public decimal TaxAmount { get; private set; }
        public decimal DiscountAmount { get; private set; }
        public decimal Total { get; private set; }
        public string Currency { get; private set; } = "ZAR";

        public InvoiceStatus Status { get; private set; } = InvoiceStatus.Draft;
        public DateTime IssueDate { get; private set; }
        public DateTime DueDate { get; private set; }
        public DateTime? PaidDate { get; private set; }
        public decimal PaidAmount { get; private set; }
        public string? PaymentMethod { get; private set; }
        public string? Notes { get; private set; }
        public string CreatedBy { get; private set; } = string.Empty;
        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public Guest? Guest { get; private set; }

        public Invoice() { }

        public Invoice(string invoiceNumber, int guestId, int propertyId, DateTime dueDate, string createdBy)
        {
            if (string.IsNullOrWhiteSpace(invoiceNumber))
                throw new ArgumentException("Invoice number cannot be empty.", nameof(invoiceNumber));
            if (guestId <= 0)
                throw new ArgumentException("GuestId must be positive.", nameof(guestId));
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (string.IsNullOrWhiteSpace(createdBy))
                throw new ArgumentException("CreatedBy cannot be empty.", nameof(createdBy));

            InvoiceNumber = invoiceNumber.Trim();
            GuestId = guestId;
            PropertyId = propertyId;
            IssueDate = DateTime.UtcNow;
            DueDate = dueDate;
            CreatedBy = createdBy.Trim();
            Status = InvoiceStatus.Draft;
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public static bool CanTransitionTo(InvoiceStatus from, InvoiceStatus to) =>
            AllowedTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);

        public void SetType(InvoiceType type)
        {
            Type = type;
            LastModified = DateTime.UtcNow;
        }

        public void AttachToBooking(int bookingId)
        {
            if (bookingId <= 0)
                throw new ArgumentException("BookingId must be positive.", nameof(bookingId));

            BookingId = bookingId;
            LastModified = DateTime.UtcNow;
        }

        public void AddItem(InvoiceItem item)
        {
            if (item == null)
                throw new ArgumentNullException(nameof(item));

            _items.Add(item);
            RecalculateTotals();
        }

        public void RemoveItem(int itemId)
        {
            var item = _items.FirstOrDefault(i => i.Id == itemId)
                ?? throw new DomainException($"Invoice item {itemId} not found.");

            _items.Remove(item);
            RecalculateTotals();
        }

        /// <summary>Flat discount applied before tax, e.g. a promo code.</summary>
        public void ApplyDiscount(decimal discount)
        {
            if (discount < 0)
                throw new ArgumentException("Discount cannot be negative.", nameof(discount));

            DiscountAmount = discount;
            RecalculateTotals();
        }

        /// <summary>Recomputes subtotal, tax and total from the current line items.</summary>
        public void RecalculateTotals()
        {
            Subtotal = _items.Sum(i => i.Amount);
            TaxAmount = _items.Sum(i => i.Amount * i.TaxRate);
            Total = Math.Max(0, Subtotal + TaxAmount - DiscountAmount);
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Moves the invoice through its lifecycle, refusing jumps that don't make sense (e.g. paid → sent).</summary>
        public void ChangeStatus(InvoiceStatus newStatus)
        {
            if (!CanTransitionTo(Status, newStatus))
                throw new DomainException($"Cannot move an invoice from '{Status.ToWire()}' to '{newStatus.ToWire()}'.");

            Status = newStatus;
            LastModified = DateTime.UtcNow;
        }

        public void RecordPayment(decimal amount, string paymentMethod)
        {
            if (amount <= 0)
                throw new ArgumentException("Payment amount must be positive.", nameof(amount));
            if (string.IsNullOrWhiteSpace(paymentMethod))
                throw new ArgumentException("Payment method cannot be empty.", nameof(paymentMethod));
            if (Status is InvoiceStatus.Cancelled or InvoiceStatus.Refunded)
                throw new DomainException($"Cannot record a payment against a '{Status.ToWire()}' invoice.");
            if (PaidAmount + amount > Total)
                throw new DomainException(
                    $"Payment of {amount:0.00} would overpay the invoice. Outstanding amount is {Total - PaidAmount:0.00}.");

            PaidAmount += amount;
            PaymentMethod = paymentMethod;
            if (PaidAmount >= Total)
            {
                Status = InvoiceStatus.Paid;
                PaidDate = DateTime.UtcNow;
            }
            else
            {
                Status = InvoiceStatus.Partial;
            }
            LastModified = DateTime.UtcNow;
        }

        public void SetNotes(string? notes)
        {
            Notes = notes;
            LastModified = DateTime.UtcNow;
        }
    }
}
