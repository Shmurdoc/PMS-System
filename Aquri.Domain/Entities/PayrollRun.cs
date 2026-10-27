using System;
using Aquri.Domain.Exceptions;
using Aquri.Domain.Payroll;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// A payroll period for one property. Draft runs can be rebuilt and thrown
    /// away; approval freezes the numbers; payment closes the run for good.
    /// Every transition records who did it, because payroll is the one place
    /// where "the system did it" is never an acceptable answer.
    /// </summary>
    public class PayrollRun
    {
        public static readonly string[] ValidStatuses = { "draft", "approved", "paid", "cancelled" };

        /// <summary>Longest period the engine will price in one run.</summary>
        public const int MaxPeriodDays = 62;

        private readonly List<Payslip> _payslips = new();

        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public DateTime PeriodStart { get; private set; }
        public DateTime PeriodEnd { get; private set; }

        /// <summary>draft | approved | paid | cancelled.</summary>
        public string Status { get; private set; } = "draft";

        public int EmployeeCount { get; private set; }
        public decimal TotalGross { get; private set; }
        public decimal TotalDeductions { get; private set; }
        public decimal TotalNet { get; private set; }
        public string Currency { get; private set; } = "ZAR";

        public string CreatedBy { get; private set; } = string.Empty;
        public string? ApprovedBy { get; private set; }
        public string? PaidBy { get; private set; }
        public string? CancellationReason { get; private set; }

        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }
        public DateTime? ApprovedAt { get; private set; }
        public DateTime? PaidAt { get; private set; }

        public IReadOnlyCollection<Payslip> Payslips => _payslips;

        public PayrollRun() { }

        public PayrollRun(int propertyId, DateTime periodStart, DateTime periodEnd, string createdBy)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (string.IsNullOrWhiteSpace(createdBy))
                throw new ArgumentException("CreatedBy is required.", nameof(createdBy));

            var start = periodStart.Date;
            var end = periodEnd.Date;
            if (end < start)
                throw new DomainException("Payroll period end cannot be before its start.");
            if ((end - start).TotalDays + 1 > MaxPeriodDays)
                throw new DomainException($"A payroll period cannot exceed {MaxPeriodDays} days.");

            PropertyId = propertyId;
            PeriodStart = start;
            PeriodEnd = end;
            CreatedBy = createdBy.Trim();
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public bool IsEditable => Status == "draft";

        /// <summary>Adds a priced slip. Only valid while the run is a draft.</summary>
        public void AddPayslip(Payslip payslip)
        {
            if (payslip is null)
                throw new ArgumentNullException(nameof(payslip));
            if (!IsEditable)
                throw new DomainException($"Cannot add a payslip to a '{Status}' run. Reopen it as a draft first.");
            if (payslip.PropertyId != PropertyId)
                throw new DomainException("Payslip belongs to a different property.");
            if (_payslips.Any(p => p.UserId == payslip.UserId))
                throw new DomainException($"{payslip.UserName} already has a payslip on this run.");

            payslip.Verify();
            payslip.AttachToRun(Id);
            _payslips.Add(payslip);
            RecalculateTotals();
        }

        /// <summary>Drops all slips so the run can be regenerated from current data.</summary>
        public void ClearPayslips()
        {
            if (!IsEditable)
                throw new DomainException($"Cannot rebuild a '{Status}' run.");

            _payslips.Clear();
            RecalculateTotals();
        }

        /// <summary>Totals always come from the slips, never from an independent sum.</summary>
        public void RecalculateTotals()
        {
            EmployeeCount = _payslips.Count;
            TotalGross = Money.Round(_payslips.Sum(p => p.GrossPay));
            TotalDeductions = Money.Round(_payslips.Sum(p => p.TotalDeductions));
            TotalNet = Money.Round(_payslips.Sum(p => p.NetPay));
            LastModified = DateTime.UtcNow;
        }

        /// <summary>
        /// Freezes the run. Two-person rule: whoever creates a payroll run
        /// cannot be the one who approves it.
        /// </summary>
        public void Approve(string actor)
        {
            if (Status != "draft")
                throw new DomainException($"Only a draft run can be approved. This run is '{Status}'.");
            if (_payslips.Count == 0)
                throw new DomainException("A payroll run cannot be approved without payslips.");
            if (TotalNet <= 0)
                throw new DomainException("A payroll run cannot be approved with a non-positive net total.");
            if (string.IsNullOrWhiteSpace(actor))
                throw new ArgumentException("Approver is required.", nameof(actor));
            if (string.Equals(actor.Trim(), CreatedBy, StringComparison.OrdinalIgnoreCase))
                throw new DomainException("Payroll must be approved by someone other than the person who created it.");

            ApprovedBy = actor.Trim();
            ApprovedAt = DateTime.UtcNow;
            Status = "approved";
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Records that the money left the bank. Terminal state.</summary>
        public void MarkPaid(string actor)
        {
            if (Status != "approved")
                throw new DomainException($"Only an approved run can be paid. This run is '{Status}'.");
            if (string.IsNullOrWhiteSpace(actor))
                throw new ArgumentException("Payer is required.", nameof(actor));

            PaidBy = actor.Trim();
            PaidAt = DateTime.UtcNow;
            Status = "paid";
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Cancels an unpaid run. A paid run can only be corrected by a reversal, not a cancel.</summary>
        public void Cancel(string reason)
        {
            if (Status == "paid")
                throw new DomainException("A paid payroll run cannot be cancelled. Raise an adjustment instead.");
            if (Status == "cancelled")
                throw new DomainException("This run is already cancelled.");
            if (string.IsNullOrWhiteSpace(reason))
                throw new ArgumentException("A cancellation reason is required.", nameof(reason));

            CancellationReason = reason.Trim();
            Status = "cancelled";
            LastModified = DateTime.UtcNow;
        }
    }
}
