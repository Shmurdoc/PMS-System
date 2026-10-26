using System;

namespace Aquri.Application.Payroll
{
    /// <summary>Body for starting or rebuilding a payroll period.</summary>
    public record CreatePayrollRunRequest(
        int PropertyId,
        DateTime PeriodStart,
        DateTime PeriodEnd,
        bool RebuildExisting = false);

    /// <summary>Cancelling an unpaid run requires a reason for the audit trail.</summary>
    public record CancelPayrollRunRequest(string Reason);

    /// <summary>Body for setting a staff member's pay package.</summary>
    public record UpsertCompensationRequest(
        int PropertyId,
        int UserId,
        string PayType,
        decimal BaseAmount,
        decimal OvertimeMultiplier,
        decimal StandardHours,
        decimal Allowances,
        decimal OtherDeductions,
        DateTime EffectiveFrom);
}
