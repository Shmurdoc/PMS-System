using System;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// A staff-submitted expense (cleaning supplies, a contractor invoice).
    /// Flows pending → approved/rejected; approvals are one-way — once decided,
    /// only an admin can reopen it.
    /// </summary>
    public class Expense
    {
        public static readonly string[] ValidStatuses = { "pending", "approved", "rejected" };
        public static readonly string[] ValidMethods = { "cash", "card", "eft", "wire_transfer", "mobile_money", "voucher" };

        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public string Category { get; private set; } = string.Empty;
        public decimal Amount { get; private set; }
        public string Description { get; private set; } = string.Empty;
        public DateTime Date { get; private set; }
        public string Status { get; private set; } = "pending";
        public string SubmittedBy { get; private set; } = string.Empty;
        public string? ReceiptUrl { get; private set; }
        public string? ApprovedBy { get; private set; }
        public DateTime? ApprovedAt { get; private set; }
        public string? Vendor { get; private set; }
        public string? PaymentMethod { get; private set; }
        public string? Notes { get; private set; }
        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public Expense() { }

        public Expense(int propertyId, string category, decimal amount, string description, DateTime date, string submittedBy, string? vendor = null, string? notes = null)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (string.IsNullOrWhiteSpace(category))
                throw new ArgumentException("Category cannot be empty.", nameof(category));
            if (amount <= 0)
                throw new ArgumentException("Amount must be positive.", nameof(amount));
            if (string.IsNullOrWhiteSpace(description))
                throw new ArgumentException("Description cannot be empty.", nameof(description));
            if (string.IsNullOrWhiteSpace(submittedBy))
                throw new ArgumentException("SubmittedBy cannot be empty.", nameof(submittedBy));

            PropertyId = propertyId;
            Category = category.Trim();
            Amount = amount;
            Description = description.Trim();
            Date = date;
            SubmittedBy = submittedBy.Trim();
            Vendor = vendor?.Trim();
            Notes = notes?.Trim();
            Status = "pending";
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Edits the expense details while it is still pending a decision.</summary>
        public void UpdateDetails(string category, decimal amount, string description, DateTime date, string? vendor, string? notes)
        {
            if (Status != "pending")
                throw new DomainException($"Only pending expenses can be edited (current: {Status}).");
            if (string.IsNullOrWhiteSpace(category))
                throw new ArgumentException("Category cannot be empty.", nameof(category));
            if (amount <= 0)
                throw new ArgumentException("Amount must be positive.", nameof(amount));
            if (string.IsNullOrWhiteSpace(description))
                throw new ArgumentException("Description cannot be empty.", nameof(description));

            Category = category.Trim();
            Amount = amount;
            Description = description.Trim();
            Date = date;
            Vendor = vendor?.Trim();
            Notes = notes?.Trim();
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Approves the expense and stamps who signed it off.</summary>
        public void Approve(string approvedBy)
        {
            if (Status != "pending")
                throw new DomainException($"Only pending expenses can be approved (current: {Status}).");
            if (string.IsNullOrWhiteSpace(approvedBy))
                throw new ArgumentException("ApprovedBy cannot be empty.", nameof(approvedBy));

            Status = "approved";
            ApprovedBy = approvedBy.Trim();
            ApprovedAt = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public void Reject(string rejectedBy)
        {
            if (Status != "pending")
                throw new DomainException($"Only pending expenses can be rejected (current: {Status}).");
            if (string.IsNullOrWhiteSpace(rejectedBy))
                throw new ArgumentException("RejectedBy cannot be empty.", nameof(rejectedBy));

            Status = "rejected";
            ApprovedBy = rejectedBy.Trim();
            ApprovedAt = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public void SetReceipt(string? receiptUrl)
        {
            ReceiptUrl = receiptUrl;
            LastModified = DateTime.UtcNow;
        }

        public void SetPaymentMethod(string paymentMethod)
        {
            if (!ValidMethods.Contains(paymentMethod))
                throw new ArgumentException($"Payment method must be one of: {string.Join(", ", ValidMethods)}.", nameof(paymentMethod));

            PaymentMethod = paymentMethod;
            LastModified = DateTime.UtcNow;
        }
    }
}
