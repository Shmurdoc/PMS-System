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
        private readonly ICurrentUser _currentUser;

        public UpdateShiftHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<ShiftDto>> Handle(UpdateShiftCommand request, CancellationToken cancellationToken)
        {
            var shift = await _context.Shifts
                .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

            if (shift is null)
                return Result<ShiftDto>.NotFoundResult();

            try
            {
                var oldBreakStart = shift.BreakStart;
                var oldBreakEnd = shift.BreakEnd;
                var oldOvertime = shift.Overtime;
                var oldNotes = shift.Notes;
                var oldDepartment = shift.Department;

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

                var changes = new List<string>();
                if (oldBreakStart != shift.BreakStart || oldBreakEnd != shift.BreakEnd)
                    changes.Add($"break: {oldBreakStart:t}-{oldBreakEnd:t} → {shift.BreakStart:t}-{shift.BreakEnd:t}");
                if (oldOvertime != shift.Overtime)
                    changes.Add($"overtime: {oldOvertime} → {shift.Overtime}");
                if (oldNotes != shift.Notes)
                    changes.Add($"notes: {oldNotes ?? "(none)"} → {shift.Notes ?? "(none)"}");
                if (oldDepartment != shift.Department)
                    changes.Add($"department: {oldDepartment ?? "(none)"} → {shift.Department ?? "(none)"}");
                var details = changes.Count > 0 ? string.Join("; ", changes) : "no field changes";

                await _context.SaveChangesAsync(cancellationToken);
                AuditTrail.Write(_context, _currentUser, "update_shift", "shift", shift.Id.ToString(), shift.UserName, null, details);
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
