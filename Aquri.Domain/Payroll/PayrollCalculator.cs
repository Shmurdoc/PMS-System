using System;
using Aquri.Domain.Entities;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Payroll
{
    /// <summary>The numbers a payslip is built from, already rounded.</summary>
    public sealed record PayslipComputation(
        decimal BaseAmount,
        decimal OvertimeAmount,
        decimal Allowances,
        decimal GrossPay,
        decimal Paye,
        decimal Uif,
        decimal OtherDeductions,
        decimal TotalDeductions,
        decimal NetPay);

    /// <summary>
    /// Prices one employee's pay period. Kept separate from the entity so the
    /// same maths can run before a row exists, and so a unit test can check it
    /// without a database.
    /// </summary>
    public static class PayrollCalculator
    {
        public static PayslipComputation Calculate(
            EmployeeCompensation compensation,
            decimal hoursWorked,
            decimal overtimeHours,
            decimal allowances,
            decimal otherDeductions)
        {
            if (compensation is null)
                throw new ArgumentNullException(nameof(compensation));
            if (hoursWorked < 0 || overtimeHours < 0)
                throw new ArgumentException("Hours cannot be negative.");
            if (overtimeHours > hoursWorked)
                throw new DomainException("Overtime hours cannot exceed total hours worked.");
            if (allowances < 0 || otherDeductions < 0)
                throw new ArgumentException("Allowances and deductions cannot be negative.");

            decimal baseAmount;
            if (compensation.PayType == "hourly")
            {
                // Hourly staff are paid for hours actually worked, capped at the
                // contracted month. Anything beyond that is overtime.
                var paidHours = Math.Min(hoursWorked, compensation.StandardHours);
                baseAmount = Money.Round(compensation.HourlyRate * paidHours);
            }
            else
            {
                baseAmount = Money.Round(compensation.BaseAmount);
            }

            var overtimeAmount = Money.Round(
                compensation.HourlyRate * compensation.OvertimeMultiplier * overtimeHours);

            var gross = Money.Round(baseAmount + overtimeAmount + allowances);
            if (gross < 0)
                throw new DomainException("Gross pay cannot be negative.");

            var paye = PayrollTaxTables.MonthlyPaye(gross);
            var uif = PayrollTaxTables.MonthlyUif(gross);
            var totalDeductions = Money.Round(paye + uif + otherDeductions);
            var net = Money.Round(gross - totalDeductions);

            if (net < 0)
                throw new DomainException(
                    $"Deductions of {totalDeductions:0.00} exceed gross pay of {gross:0.00} for {compensation.UserName}.");

            return new PayslipComputation(
                baseAmount,
                overtimeAmount,
                Money.Round(allowances),
                gross,
                paye,
                uif,
                Money.Round(otherDeductions),
                totalDeductions,
                net);
        }
    }
}
