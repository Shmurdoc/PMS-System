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

        public UpdateAttendanceHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<AttendanceDto>> Handle(UpdateAttendanceCommand request, CancellationToken cancellationToken)
        {
            var record = await _context.AttendanceRecords
                .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

            if (record is null)
                return Result<AttendanceDto>.NotFoundResult();

            try
            {
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

        public DeleteAttendanceHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result> Handle(DeleteAttendanceCommand request, CancellationToken cancellationToken)
        {
            var record = await _context.AttendanceRecords
                .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

            if (record is null)
                return Result.NotFoundResult();

            _context.AttendanceRecords.Remove(record);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
