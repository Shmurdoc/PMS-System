using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Shifts
{
    /// <summary>Edits a shift's break, overtime, notes, and department. Omitted fields keep their current values.</summary>
    public record UpdateShiftCommand(
        int Id,
        DateTime? BreakStart,
        DateTime? BreakEnd,
        decimal? Overtime,
        string? Notes,
        string? Department) : IRequest<Result<ShiftDto>>;

    public class UpdateShiftHandler : IRequestHandler<UpdateShiftCommand, Result<ShiftDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateShiftHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<ShiftDto>> Handle(UpdateShiftCommand request, CancellationToken cancellationToken)
        {
            var shift = await _context.Shifts
                .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

            if (shift is null)
                return Result<ShiftDto>.NotFoundResult();

            try
            {
                if (request.BreakStart.HasValue || request.BreakEnd.HasValue)
                {
                    if (!request.BreakStart.HasValue || !request.BreakEnd.HasValue)
                        return Result<ShiftDto>.Failure("BreakStart and BreakEnd must be provided together.");

                    shift.SetBreak(request.BreakStart.Value, request.BreakEnd.Value);
                }

                if (request.Overtime.HasValue)
                    shift.RecordOvertime(request.Overtime.Value);

                if (request.Notes is not null)
                    shift.SetNotes(request.Notes);

                if (request.Department is not null)
                    shift.SetDepartment(request.Department);

                await _context.SaveChangesAsync(cancellationToken);
                return Result<ShiftDto>.SuccessResult(ShiftDto.FromEntity(shift));
            }
            catch (ArgumentException ex)
            {
                return Result<ShiftDto>.Failure(ex.Message);
            }
        }
    }
}
