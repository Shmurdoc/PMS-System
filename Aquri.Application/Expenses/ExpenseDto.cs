using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.Expenses
{
    /// <summary>Staff-submitted expense as returned by the API.</summary>
    public class ExpenseDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public string Category { get; init; } = string.Empty;
        public decimal Amount { get; init; }
        public string Description { get; init; } = string.Empty;
        public DateTime Date { get; init; }
        public string Status { get; init; } = "pending";
        public string SubmittedBy { get; init; } = string.Empty;
        public string? ReceiptUrl { get; init; }
        public string? ApprovedBy { get; init; }
        public DateTime? ApprovedAt { get; init; }
        public string? Vendor { get; init; }
        public string? PaymentMethod { get; init; }
        public string? Notes { get; init; }
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static ExpenseDto FromEntity(Expense expense) => new()
        {
            Id = expense.Id,
            PropertyId = expense.PropertyId,
            Category = expense.Category,
            Amount = expense.Amount,
            Description = expense.Description,
            Date = expense.Date,
            Status = expense.Status,
            SubmittedBy = expense.SubmittedBy,
            ReceiptUrl = expense.ReceiptUrl,
            ApprovedBy = expense.ApprovedBy,
            ApprovedAt = expense.ApprovedAt,
            Vendor = expense.Vendor,
            PaymentMethod = expense.PaymentMethod,
            Notes = expense.Notes,
            Created = expense.Created,
            LastModified = expense.LastModified
        };
    }
}
