using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.Payroll
{
    /// <summary>A staff member's pay package as returned by the API.</summary>
    public class CompensationDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public int UserId { get; init; }
        public string UserName { get; init; } = string.Empty;
        public string PayType { get; init; } = "salary";
        public decimal BaseAmount { get; init; }
        public decimal OvertimeMultiplier { get; init; }
        public decimal StandardHours { get; init; }
        public decimal Allowances { get; init; }
        public decimal OtherDeductions { get; init; }
        public decimal HourlyRate { get; init; }
        public string Currency { get; init; } = "ZAR";
        public DateTime EffectiveFrom { get; init; }
        public bool Active { get; init; }
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static CompensationDto FromEntity(EmployeeCompensation c) => new()
        {
            Id = c.Id,
            PropertyId = c.PropertyId,
            UserId = c.UserId,
            UserName = c.UserName,
            PayType = c.PayType,
            BaseAmount = c.BaseAmount,
            OvertimeMultiplier = c.OvertimeMultiplier,
            StandardHours = c.StandardHours,
            Allowances = c.Allowances,
            OtherDeductions = c.OtherDeductions,
            HourlyRate = c.HourlyRate,
            Currency = c.Currency,
            EffectiveFrom = c.EffectiveFrom,
            Active = c.Active,
            Created = c.Created,
            LastModified = c.LastModified
        };
    }

    /// <summary>One employee's frozen pay for a run.</summary>
    public class PayslipDto
    {
        public int Id { get; init; }
        public int PayrollRunId { get; init; }
        public int PropertyId { get; init; }
        public int UserId { get; init; }
        public string UserName { get; init; } = string.Empty;
        public string PayType { get; init; } = "salary";
        public decimal BaseRate { get; init; }
        public decimal OvertimeMultiplier { get; init; }
        public decimal StandardHours { get; init; }
        public decimal HoursWorked { get; init; }
        public decimal OvertimeHours { get; init; }
        public decimal BaseAmount { get; init; }
        public decimal OvertimeAmount { get; init; }
        public decimal Allowances { get; init; }
        public decimal GrossPay { get; init; }
        public decimal Paye { get; init; }
        public decimal Uif { get; init; }
        public decimal OtherDeductions { get; init; }
        public decimal TotalDeductions { get; init; }
        public decimal NetPay { get; init; }
        public string Currency { get; init; } = "ZAR";
        public string TaxYear { get; init; } = string.Empty;
        public DateTime Created { get; init; }

        public static PayslipDto FromEntity(Payslip p) => new()
        {
            Id = p.Id,
            PayrollRunId = p.PayrollRunId,
            PropertyId = p.PropertyId,
            UserId = p.UserId,
            UserName = p.UserName,
            PayType = p.PayType,
            BaseRate = p.BaseRate,
            OvertimeMultiplier = p.OvertimeMultiplier,
            StandardHours = p.StandardHours,
            HoursWorked = p.HoursWorked,
            OvertimeHours = p.OvertimeHours,
            BaseAmount = p.BaseAmount,
            OvertimeAmount = p.OvertimeAmount,
            Allowances = p.Allowances,
            GrossPay = p.GrossPay,
            Paye = p.Paye,
            Uif = p.Uif,
            OtherDeductions = p.OtherDeductions,
            TotalDeductions = p.TotalDeductions,
            NetPay = p.NetPay,
            Currency = p.Currency,
            TaxYear = p.TaxYear,
            Created = p.Created
        };
    }

    /// <summary>A payroll period, with payslips when the caller asked for detail.</summary>
    public class PayrollRunDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public DateTime PeriodStart { get; init; }
        public DateTime PeriodEnd { get; init; }
        public string Status { get; init; } = "draft";
        public int EmployeeCount { get; init; }
        public decimal TotalGross { get; init; }
        public decimal TotalDeductions { get; init; }
        public decimal TotalNet { get; init; }
        public string Currency { get; init; } = "ZAR";
        public string CreatedBy { get; init; } = string.Empty;
        public string? ApprovedBy { get; init; }
        public string? PaidBy { get; init; }
        public string? CancellationReason { get; init; }
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }
        public DateTime? ApprovedAt { get; init; }
        public DateTime? PaidAt { get; init; }
        public List<PayslipDto>? Payslips { get; init; }

        public static PayrollRunDto FromEntity(PayrollRun run, bool includePayslips = false) => new()
        {
            Id = run.Id,
            PropertyId = run.PropertyId,
            PeriodStart = run.PeriodStart,
            PeriodEnd = run.PeriodEnd,
            Status = run.Status,
            EmployeeCount = run.EmployeeCount,
            TotalGross = run.TotalGross,
            TotalDeductions = run.TotalDeductions,
            TotalNet = run.TotalNet,
            Currency = run.Currency,
            CreatedBy = run.CreatedBy,
            ApprovedBy = run.ApprovedBy,
            PaidBy = run.PaidBy,
            CancellationReason = run.CancellationReason,
            Created = run.Created,
            LastModified = run.LastModified,
            ApprovedAt = run.ApprovedAt,
            PaidAt = run.PaidAt,
            Payslips = includePayslips
                ? run.Payslips.OrderBy(p => p.UserName).Select(PayslipDto.FromEntity).ToList()
                : null
        };
    }
}
