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

        public ChangeShiftStatusHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<ShiftDto>> Handle(ChangeShiftStatusCommand request, CancellationToken cancellationToken)
        {
            var shift = await _context.Shifts
                .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

            if (shift is null)
                return Result<ShiftDto>.NotFoundResult();

            try
            {
                shift.ChangeStatus(request.Status);
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

        public SwapShiftHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<ShiftDto>> Handle(SwapShiftCommand request, CancellationToken cancellationToken)
        {
            var shift = await _context.Shifts
                .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

            if (shift is null)
                return Result<ShiftDto>.NotFoundResult();

            try
            {
                shift.Swap(request.NewStaffName);
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

        public DeleteShiftHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result> Handle(DeleteShiftCommand request, CancellationToken cancellationToken)
        {
            var shift = await _context.Shifts
                .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

            if (shift is null)
                return Result.NotFoundResult();

            _context.Shifts.Remove(shift);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
