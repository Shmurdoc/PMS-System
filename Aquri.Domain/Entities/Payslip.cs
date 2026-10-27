using System;
using Aquri.Domain.Exceptions;
using Aquri.Domain.Payroll;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// One employee's pay for one run. Every number is stored, not recomputed on
    /// read, so a later raise or tax-year change cannot rewrite history. The
    /// constructor recomputes and rejects any combination that does not add up.
    /// </summary>
    public class Payslip
    {
        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public int PayrollRunId { get; private set; }
        public int UserId { get; private set; }
        public string UserName { get; private set; } = string.Empty;

        /// <summary>Snapshot of the package the slip was priced from.</summary>
        public string PayType { get; private set; } = "salary";
        public decimal BaseRate { get; private set; }
        public decimal OvertimeMultiplier { get; private set; }
        public decimal StandardHours { get; private set; }

        public decimal HoursWorked { get; private set; }
        public decimal OvertimeHours { get; private set; }

        public decimal BaseAmount { get; private set; }
        public decimal OvertimeAmount { get; private set; }
        public decimal Allowances { get; private set; }
        public decimal GrossPay { get; private set; }

        public decimal Paye { get; private set; }
        public decimal Uif { get; private set; }
        public decimal OtherDeductions { get; private set; }
        public decimal TotalDeductions { get; private set; }
        public decimal NetPay { get; private set; }

        public string Currency { get; private set; } = "ZAR";
        public string TaxYear { get; private set; } = PayrollTaxTables.TaxYear;
        public DateTime Created { get; private set; }

        public PayrollRun? PayrollRun { get; private set; }

        public Payslip() { }

        public Payslip(
            int propertyId,
            int payrollRunId,
            EmployeeCompensation compensation,
            decimal hoursWorked,
            decimal overtimeHours,
            decimal allowances,
            decimal otherDeductions)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (payrollRunId < 0)
                throw new ArgumentException("PayrollRunId cannot be negative.", nameof(payrollRunId));
            if (compensation is null)
                throw new ArgumentNullException(nameof(compensation));
            if (compensation.PropertyId != propertyId)
                throw new DomainException("Compensation belongs to a different property.");
            if (hoursWorked < 0 || overtimeHours < 0)
                throw new ArgumentException("Hours cannot be negative.");
            if (overtimeHours > hoursWorked)
                throw new DomainException("Overtime hours cannot exceed total hours worked.");
            if (allowances < 0 || otherDeductions < 0)
                throw new ArgumentException("Allowances and deductions cannot be negative.");

            var computed = PayrollCalculator.Calculate(compensation, hoursWorked, overtimeHours, allowances, otherDeductions);

            PropertyId = propertyId;
            PayrollRunId = payrollRunId;
            UserId = compensation.UserId;
            UserName = compensation.UserName;
            PayType = compensation.PayType;
            BaseRate = compensation.BaseAmount;
            OvertimeMultiplier = compensation.OvertimeMultiplier;
            StandardHours = compensation.StandardHours;
            HoursWorked = hoursWorked;
            OvertimeHours = overtimeHours;
            BaseAmount = computed.BaseAmount;
            OvertimeAmount = computed.OvertimeAmount;
            Allowances = computed.Allowances;
            GrossPay = computed.GrossPay;
            Paye = computed.Paye;
            Uif = computed.Uif;
            OtherDeductions = computed.OtherDeductions;
            TotalDeductions = computed.TotalDeductions;
            NetPay = computed.NetPay;
            Currency = compensation.Currency;
            Created = DateTime.UtcNow;

            Verify();
        }

        /// <summary>
        /// Links the slip to its run. A brand new run has no database id yet, so
        /// the link is filled in again after the insert.
        /// </summary>
        public void AttachToRun(int payrollRunId)
        {
            if (payrollRunId < 0)
                throw new ArgumentException("PayrollRunId cannot be negative.", nameof(payrollRunId));
            if (PayrollRunId != 0 && PayrollRunId != payrollRunId)
                throw new DomainException("Payslip already belongs to a different payroll run.");

            PayrollRunId = payrollRunId;
        }

        /// <summary>
        /// Last line of defence before a row is persisted. Any caller that could
        /// bypass the constructor still cannot store a slip that fails these.
        /// </summary>
        public void Verify()
        {
            var expectedGross = Money.Round(BaseAmount + OvertimeAmount + Allowances);
            if (GrossPay != expectedGross)
                throw new DomainException($"Payslip gross {GrossPay:0.00} does not equal base + overtime + allowances ({expectedGross:0.00}).");

            var expectedDeductions = Money.Round(Paye + Uif + OtherDeductions);
            if (TotalDeductions != expectedDeductions)
                throw new DomainException($"Payslip deductions {TotalDeductions:0.00} do not add up ({expectedDeductions:0.00}).");

            var expectedNet = Money.Round(GrossPay - TotalDeductions);
            if (NetPay != expectedNet)
                throw new DomainException($"Payslip net {NetPay:0.00} does not equal gross minus deductions ({expectedNet:0.00}).");

            if (NetPay < 0)
                throw new DomainException("Net pay cannot be negative. Reduce deductions or add an allowance.");

            if (GrossPay < 0)
                throw new DomainException("Gross pay cannot be negative.");
        }
    }
}
