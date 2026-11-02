using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Shifts
{
    /// <summary>Moves a shift through its lifecycle: scheduled, completed, cancelled, or swapped.</summary>
    public record ChangeShiftStatusCommand(int Id, string Status) : IRequest<Result<ShiftDto>>;

    public class ChangeShiftStatusHandler : IRequestHandler<ChangeShiftStatusCommand, Result<ShiftDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public ChangeShiftStatusHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<ShiftDto>> Handle(ChangeShiftStatusCommand request, CancellationToken cancellationToken)
        {
            var shift = await _context.Shifts
                .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

            if (shift is null)
                return Result<ShiftDto>.NotFoundResult();

            try
            {
                var oldStatus = shift.Status;
                shift.ChangeStatus(request.Status);
                AuditTrail.Write(_context, _currentUser, "change_shift_status", "shift", shift.Id.ToString(), shift.UserName, oldStatus, shift.Status);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<ShiftDto>.SuccessResult(ShiftDto.FromEntity(shift));
            }
            catch (ArgumentException ex)
            {
                return Result<ShiftDto>.Failure(ex.Message);
            }
        }
    }

    /// <summary>Reassigns a shift to another staff member, keeping who-covered-what on the record.</summary>
    public record SwapShiftCommand(int Id, string NewStaffName) : IRequest<Result<ShiftDto>>;

    public class SwapShiftHandler : IRequestHandler<SwapShiftCommand, Result<ShiftDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public SwapShiftHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<ShiftDto>> Handle(SwapShiftCommand request, CancellationToken cancellationToken)
        {
            var shift = await _context.Shifts
                .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

            if (shift is null)
                return Result<ShiftDto>.NotFoundResult();

            try
            {
                var oldStaffName = shift.UserName;
                shift.Swap(request.NewStaffName);
                AuditTrail.Write(_context, _currentUser, "swap_shift_staff", "shift", shift.Id.ToString(), shift.UserName, oldStaffName, shift.UserName);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<ShiftDto>.SuccessResult(ShiftDto.FromEntity(shift));
            }
            catch (ArgumentException ex)
            {
                return Result<ShiftDto>.Failure(ex.Message);
            }
            catch (DomainException ex)
            {
                return Result<ShiftDto>.Failure(ex.Message);
            }
        }
    }

    public record DeleteShiftCommand(int Id) : IRequest<Result>;

    public class DeleteShiftHandler : IRequestHandler<DeleteShiftCommand, Result>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public DeleteShiftHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result> Handle(DeleteShiftCommand request, CancellationToken cancellationToken)
        {
            var shift = await _context.Shifts
                .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

            if (shift is null)
                return Result.NotFoundResult();

            var shiftUserName = shift.UserName;
            var shiftId = shift.Id.ToString();
            _context.Shifts.Remove(shift);
            AuditTrail.Write(_context, _currentUser, "delete_shift", "shift", shiftId, shiftUserName);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
