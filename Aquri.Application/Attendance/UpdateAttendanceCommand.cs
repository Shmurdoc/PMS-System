using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Attendance
{
    /// <summary>Edits an attendance record: clocks out, transitions status, and updates notes. Omitted fields keep their current values.</summary>
    public record UpdateAttendanceCommand(
        int Id,
        DateTime? CheckOut,
        string? Status,
        string? Notes) : IRequest<Result<AttendanceDto>>;

    public class UpdateAttendanceHandler : IRequestHandler<UpdateAttendanceCommand, Result<AttendanceDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public UpdateAttendanceHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<AttendanceDto>> Handle(UpdateAttendanceCommand request, CancellationToken cancellationToken)
        {
            var record = await _context.AttendanceRecords
                .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

            if (record is null)
                return Result<AttendanceDto>.NotFoundResult();

            try
            {
                var oldCheckOut = record.CheckOut;
                var oldStatus = record.Status;
                var oldNotes = record.Notes;

                if (request.CheckOut.HasValue)
                    record.ClockOut(request.CheckOut.Value);

                if (request.Status is not null && request.Status != record.Status)
                {
                    if (request.Status == "late")
                        record.MarkLate();
                    else if (request.Status == "on_leave")
                        record.MarkOnLeave(null);
                    else
                        return Result<AttendanceDto>.Failure(
                            $"Cannot change status from '{record.Status}' to '{request.Status}'.");
                }

                if (request.Notes is not null)
                    record.SetNotes(request.Notes);

                var changes = new List<string>();
                if (oldCheckOut != record.CheckOut)
                    changes.Add($"check out: {oldCheckOut:t} → {record.CheckOut:t}");
                if (oldStatus != record.Status)
                    changes.Add($"status: {oldStatus} → {record.Status}");
                if (oldNotes != record.Notes)
                    changes.Add($"notes: {oldNotes ?? "(none)"} → {record.Notes ?? "(none)"}");
                var details = changes.Count > 0 ? string.Join("; ", changes) : "no field changes";

                await _context.SaveChangesAsync(cancellationToken);
                AuditTrail.Write(_context, _currentUser, "update_attendance", "attendance", record.Id.ToString(), record.UserName, null, details);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<AttendanceDto>.SuccessResult(AttendanceDto.FromEntity(record));
            }
            catch (ArgumentException ex)
            {
                return Result<AttendanceDto>.Failure(ex.Message);
            }
            catch (DomainException ex)
            {
                return Result<AttendanceDto>.Failure(ex.Message);
            }
        }
    }

    /// <summary>Removes an attendance record (admin correction).</summary>
    public record DeleteAttendanceCommand(int Id) : IRequest<Result>;

    public class DeleteAttendanceHandler : IRequestHandler<DeleteAttendanceCommand, Result>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public DeleteAttendanceHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result> Handle(DeleteAttendanceCommand request, CancellationToken cancellationToken)
        {
            var record = await _context.AttendanceRecords
                .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

            if (record is null)
                return Result.NotFoundResult();

            var recordUserName = record.UserName;
            var recordId = record.Id.ToString();
            _context.AttendanceRecords.Remove(record);
            AuditTrail.Write(_context, _currentUser, "delete_attendance", "attendance", recordId, recordUserName);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
