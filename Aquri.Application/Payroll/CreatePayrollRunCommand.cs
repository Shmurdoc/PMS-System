using System;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Payroll
{
    /// <summary>
    /// Builds a payroll run from the active pay packages and the attendance
    /// clocked in the period. Nothing is estimated: an hourly employee with no
    /// clocked hours gets no slip, and a salaried employee is paid the package
    /// regardless of attendance.
    /// </summary>
    public record CreatePayrollRunCommand(
        int PropertyId,
        DateTime PeriodStart,
        DateTime PeriodEnd,
        string CreatedBy,
        bool RebuildExisting = false) : IRequest<Result<PayrollRunDto>>;

    public class CreatePayrollRunHandler : IRequestHandler<CreatePayrollRunCommand, Result<PayrollRunDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public CreatePayrollRunHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<PayrollRunDto>> Handle(CreatePayrollRunCommand request, CancellationToken cancellationToken)
        {
            try
            {
                var propertyId = request.PropertyId > 0 ? request.PropertyId : _currentUser.PropertyId ?? 0;
                if (propertyId <= 0)
                    return Result<PayrollRunDto>.Failure("A property is required to run payroll.");

                var start = request.PeriodStart.Date;
                var end = request.PeriodEnd.Date;

                var overlapping = await _context.PayrollRuns
                    .Where(r => r.PropertyId == propertyId
                                && r.Status != "cancelled"
                                && r.PeriodStart <= end
                                && r.PeriodEnd >= start)
                    .ToListAsync(cancellationToken);

                PayrollRun run;
                var exact = overlapping.FirstOrDefault(r => r.PeriodStart == start && r.PeriodEnd == end);

                if (exact is not null)
                {
                    if (!request.RebuildExisting)
                        return Result<PayrollRunDto>.ConflictResult(
                            $"A payroll run for {start:yyyy-MM-dd} to {end:yyyy-MM-dd} already exists ({exact.Status}). Rebuild it instead of creating a duplicate.");

                    if (!exact.IsEditable)
                        return Result<PayrollRunDto>.ConflictResult(
                            $"This period is already '{exact.Status}'. Approved payroll cannot be rebuilt.");

                    run = exact;
                    run.ClearPayslips();
                }
                else
                {
                    if (overlapping.Count > 0)
                    {
                        var clash = overlapping[0];
                        return Result<PayrollRunDto>.ConflictResult(
                            $"This period overlaps an existing run ({clash.PeriodStart:yyyy-MM-dd} to {clash.PeriodEnd:yyyy-MM-dd}, {clash.Status}).");
                    }

                    run = new PayrollRun(propertyId, start, end, request.CreatedBy);
                    _context.PayrollRuns.Add(run);
                }

                var compensations = await _context.EmployeeCompensations
                    .Where(c => c.PropertyId == propertyId && c.Active)
                    .ToListAsync(cancellationToken);

                if (compensations.Count == 0)
                    return Result<PayrollRunDto>.Failure(
                        "No active pay packages exist for this property. Set up compensation before running payroll.");

                var attendance = await _context.AttendanceRecords
                    .Where(a => a.PropertyId == propertyId && a.Date >= start && a.Date <= end)
                    .GroupBy(a => a.UserId)
                    .Select(g => new
                    {
                        UserId = g.Key,
                        Hours = g.Sum(x => x.HoursWorked ?? 0m),
                        Overtime = g.Sum(x => x.Overtime ?? 0m)
                    })
                    .ToListAsync(cancellationToken);

                var byUser = attendance.ToDictionary(a => a.UserId);

                foreach (var compensation in compensations)
                {
                    byUser.TryGetValue(compensation.UserId, out var worked);
                    var hours = worked?.Hours ?? 0m;
                    var overtime = worked?.Overtime ?? 0m;
                    if (overtime > hours)
                        overtime = hours;

                    // Hourly staff with nothing clocked are not owed a slip.
                    if (compensation.PayType == "hourly" && hours == 0m)
                        continue;

                    var payslip = new Payslip(
                        propertyId,
                        run.Id,
                        compensation,
                        hours,
                        overtime,
                        compensation.Allowances,
                        compensation.OtherDeductions);

                    run.AddPayslip(payslip);
                }

                if (run.EmployeeCount == 0)
                    return Result<PayrollRunDto>.Failure(
                        "Nothing to pay: no active package produced a payslip for this period.");

                await _context.SaveChangesAsync(cancellationToken);

                return Result<PayrollRunDto>.SuccessResult(PayrollRunDto.FromEntity(run, includePayslips: true));
            }
            catch (DomainException ex)
            {
                return Result<PayrollRunDto>.ConflictResult(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return Result<PayrollRunDto>.Failure(ex.Message);
            }
        }
    }
}
