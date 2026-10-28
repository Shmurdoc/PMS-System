using System;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Payroll
{
    /// <summary>Freezes a draft run. The approver is taken from the token, never from the body.</summary>
    public record ApprovePayrollRunCommand(int Id) : IRequest<Result<PayrollRunDto>>;

    public class ApprovePayrollRunHandler : IRequestHandler<ApprovePayrollRunCommand, Result<PayrollRunDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public ApprovePayrollRunHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<PayrollRunDto>> Handle(ApprovePayrollRunCommand request, CancellationToken cancellationToken)
        {
            var run = await _context.PayrollRuns
                .Include(r => r.Payslips)
                .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

            if (run is null)
                return Result<PayrollRunDto>.NotFoundResult();

            try
            {
                run.Approve(_currentUser.UserName);
            }
            catch (DomainException ex)
            {
                return Result<PayrollRunDto>.ConflictResult(ex.Message);
            }

            AuditTrail.Write(_context, _currentUser, "approve_payroll_run", "payroll_run", run.Id.ToString(), run.Id.ToString());
            await _context.SaveChangesAsync(cancellationToken);
            return Result<PayrollRunDto>.SuccessResult(PayrollRunDto.FromEntity(run, includePayslips: true));
        }
    }

    /// <summary>Marks an approved run as paid. Terminal.</summary>
    public record MarkPayrollRunPaidCommand(int Id) : IRequest<Result<PayrollRunDto>>;

    public class MarkPayrollRunPaidHandler : IRequestHandler<MarkPayrollRunPaidCommand, Result<PayrollRunDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public MarkPayrollRunPaidHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<PayrollRunDto>> Handle(MarkPayrollRunPaidCommand request, CancellationToken cancellationToken)
        {
            var run = await _context.PayrollRuns
                .Include(r => r.Payslips)
                .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

            if (run is null)
                return Result<PayrollRunDto>.NotFoundResult();

            try
            {
                run.MarkPaid(_currentUser.UserName);
            }
            catch (DomainException ex)
            {
                return Result<PayrollRunDto>.ConflictResult(ex.Message);
            }

            AuditTrail.Write(_context, _currentUser, "pay_payroll_run", "payroll_run", run.Id.ToString(), run.Id.ToString());
            await _context.SaveChangesAsync(cancellationToken);
            return Result<PayrollRunDto>.SuccessResult(PayrollRunDto.FromEntity(run, includePayslips: true));
        }
    }

    /// <summary>Cancels an unpaid run with a stated reason. Paid runs need an adjustment instead.</summary>
    public record CancelPayrollRunCommand(int Id, string Reason) : IRequest<Result<PayrollRunDto>>;

    public class CancelPayrollRunHandler : IRequestHandler<CancelPayrollRunCommand, Result<PayrollRunDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public CancelPayrollRunHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<PayrollRunDto>> Handle(CancelPayrollRunCommand request, CancellationToken cancellationToken)
        {
            var run = await _context.PayrollRuns
                .Include(r => r.Payslips)
                .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

            if (run is null)
                return Result<PayrollRunDto>.NotFoundResult();

            try
            {
                run.Cancel(request.Reason);
            }
            catch (DomainException ex)
            {
                return Result<PayrollRunDto>.ConflictResult(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return Result<PayrollRunDto>.Failure(ex.Message);
            }

            AuditTrail.Write(_context, _currentUser, "cancel_payroll_run", "payroll_run", run.Id.ToString(), run.Id.ToString());
            await _context.SaveChangesAsync(cancellationToken);
            return Result<PayrollRunDto>.SuccessResult(PayrollRunDto.FromEntity(run, includePayslips: true));
        }
    }
}
