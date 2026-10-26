using System;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// What a staff member is paid at a property. Only one row per user can be
    /// active; a raise ends the old row and starts a new one so payroll history
    /// keeps the rate that actually applied at the time.
    /// </summary>
    public class EmployeeCompensation
    {
        public static readonly string[] ValidPayTypes = { "salary", "hourly" };

        /// <summary>Statutory monthly hours used to price overtime for salaried staff.</summary>
        public const decimal DefaultStandardHours = 173.33m;

        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public int UserId { get; private set; }
        public string UserName { get; private set; } = string.Empty;

        /// <summary>salary (monthly base) or hourly (rate per hour).</summary>
        public string PayType { get; private set; } = "salary";

        /// <summary>Monthly salary, or hourly rate when <see cref="PayType"/> is hourly.</summary>
        public decimal BaseAmount { get; private set; }

        /// <summary>Overtime multiplier applied to the derived hourly rate. Statutory minimum is 1.0.</summary>
        public decimal OvertimeMultiplier { get; private set; } = 1.5m;

        /// <summary>Contracted monthly hours. Used for hourly caps and salary overtime pricing.</summary>
        public decimal StandardHours { get; private set; } = DefaultStandardHours;

        /// <summary>Recurring monthly allowance (transport, housing). Part of gross.</summary>
        public decimal Allowances { get; private set; }

        /// <summary>Recurring deduction outside statutory PAYE/UIF (loan repayment, garnishee).</summary>
        public decimal OtherDeductions { get; private set; }

        public string Currency { get; private set; } = "ZAR";
        public DateTime EffectiveFrom { get; private set; }
        public bool Active { get; private set; }
        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public EmployeeCompensation() { }

        public EmployeeCompensation(
            int propertyId,
            int userId,
            string userName,
            string payType,
            decimal baseAmount,
            decimal overtimeMultiplier,
            decimal standardHours,
            DateTime effectiveFrom,
            decimal allowances = 0m,
            decimal otherDeductions = 0m)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (userId <= 0)
                throw new ArgumentException("UserId must be positive.", nameof(userId));
            if (string.IsNullOrWhiteSpace(userName))
                throw new ArgumentException("UserName cannot be empty.", nameof(userName));
            if (!ValidPayTypes.Contains(payType))
                throw new ArgumentException($"Pay type must be one of: {string.Join(", ", ValidPayTypes)}.", nameof(payType));
            if (baseAmount <= 0)
                throw new ArgumentException("Base amount must be positive.", nameof(baseAmount));
            if (overtimeMultiplier < 1m)
                throw new ArgumentException("Overtime multiplier cannot be below 1.0.", nameof(overtimeMultiplier));
            if (standardHours <= 0)
                throw new ArgumentException("Standard hours must be positive.", nameof(standardHours));
            if (effectiveFrom == default)
                throw new ArgumentException("Effective date is required.", nameof(effectiveFrom));
            if (allowances < 0 || otherDeductions < 0)
                throw new ArgumentException("Allowances and deductions cannot be negative.");

            PropertyId = propertyId;
            UserId = userId;
            UserName = userName.Trim();
            PayType = payType;
            BaseAmount = Payroll.Money.Round(baseAmount);
            OvertimeMultiplier = overtimeMultiplier;
            StandardHours = standardHours;
            EffectiveFrom = effectiveFrom.Date;
            Allowances = Payroll.Money.Round(allowances);
            OtherDeductions = Payroll.Money.Round(otherDeductions);
            Active = true;
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Hourly rate implied by this package, used to price overtime.</summary>
        public decimal HourlyRate => PayType == "hourly"
            ? BaseAmount
            : Payroll.Money.Round(BaseAmount / StandardHours);

        public void Update(decimal baseAmount, decimal overtimeMultiplier, decimal standardHours)
        {
            if (baseAmount <= 0)
                throw new ArgumentException("Base amount must be positive.", nameof(baseAmount));
            if (overtimeMultiplier < 1m)
                throw new ArgumentException("Overtime multiplier cannot be below 1.0.", nameof(overtimeMultiplier));
            if (standardHours <= 0)
                throw new ArgumentException("Standard hours must be positive.", nameof(standardHours));

            BaseAmount = Payroll.Money.Round(baseAmount);
            OvertimeMultiplier = overtimeMultiplier;
            StandardHours = standardHours;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Retires this package. Payroll runs already generated keep their snapshot.</summary>
        public void Deactivate()
        {
            Active = false;
            LastModified = DateTime.UtcNow;
        }
    }
}
