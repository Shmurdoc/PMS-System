using System;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Payroll
{
    /// <summary>Lists payroll runs. Scoped accounts only ever see their own property.</summary>
    public record GetPayrollRunsQuery(int? PropertyId, string? Status, int? Year)
        : IRequest<List<PayrollRunDto>>;

    public class GetPayrollRunsHandler : IRequestHandler<GetPayrollRunsQuery, List<PayrollRunDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetPayrollRunsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<PayrollRunDto>> Handle(GetPayrollRunsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.PayrollRuns.AsNoTracking().AsQueryable();

            if (request.PropertyId is > 0)
                query = query.Where(r => r.PropertyId == request.PropertyId);
            if (!string.IsNullOrWhiteSpace(request.Status))
                query = query.Where(r => r.Status == request.Status);
            if (request.Year is > 0)
                query = query.Where(r => r.PeriodStart.Year == request.Year || r.PeriodEnd.Year == request.Year);

            var runs = await query
                .OrderByDescending(r => r.PeriodStart)
                .ToListAsync(cancellationToken);

            return runs.Select(r => PayrollRunDto.FromEntity(r)).ToList();
        }
    }

    /// <summary>One run with its payslips.</summary>
    public record GetPayrollRunQuery(int Id) : IRequest<Result<PayrollRunDto>>;

    public class GetPayrollRunHandler : IRequestHandler<GetPayrollRunQuery, Result<PayrollRunDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetPayrollRunHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<PayrollRunDto>> Handle(GetPayrollRunQuery request, CancellationToken cancellationToken)
        {
            var run = await _context.PayrollRuns
                .AsNoTracking()
                .Include(r => r.Payslips)
                .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

            if (run is null)
                return Result<PayrollRunDto>.NotFoundResult();

            return Result<PayrollRunDto>.SuccessResult(PayrollRunDto.FromEntity(run, includePayslips: true));
        }
    }

    /// <summary>
    /// One employee's payslip history, newest first. Used by the employee
    /// profile and by a staff member checking their own slips.
    /// </summary>
    public record GetPayslipsQuery(int? PropertyId, int? UserId, DateTime? From, DateTime? To, bool PublishedOnly = false)
        : IRequest<List<PayslipDto>>;

    public class GetPayslipsHandler : IRequestHandler<GetPayslipsQuery, List<PayslipDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetPayslipsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<PayslipDto>> Handle(GetPayslipsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Payslips
                .AsNoTracking()
                .Include(p => p.PayrollRun)
                .AsQueryable();

            if (request.PropertyId is > 0)
                query = query.Where(p => p.PropertyId == request.PropertyId);
            if (request.UserId is > 0)
                query = query.Where(p => p.UserId == request.UserId);
            // Filter by pay period, not row creation: a run generated late still
            // belongs to the month it covers.
            if (request.From.HasValue)
                query = query.Where(p => p.PayrollRun!.PeriodEnd >= request.From.Value.Date);
            if (request.To.HasValue)
                query = query.Where(p => p.PayrollRun!.PeriodStart <= request.To.Value.Date);

            // An employee only sees pay that has been signed off. Draft numbers
            // can still change, so showing them would be misleading.
            if (request.PublishedOnly)
                query = query.Where(p => p.PayrollRun!.Status == "approved" || p.PayrollRun.Status == "paid");

            var slips = await query
                .OrderByDescending(p => p.Created)
                .ToListAsync(cancellationToken);

            return slips.Select(PayslipDto.FromEntity).ToList();
        }
    }
}
