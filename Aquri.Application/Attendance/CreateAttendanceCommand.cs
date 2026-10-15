using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Exceptions;
using MediatR;

namespace Aquri.Application.Attendance
{
    /// <summary>Records a clock-in (or an absent/no-show entry) for a staff member.</summary>
    public record CreateAttendanceCommand(
        int PropertyId,
        int UserId,
        string UserName,
        DateTime CheckIn,
        string? Status,
        string? Notes) : IRequest<Result<AttendanceDto>>;

    public class CreateAttendanceHandler : IRequestHandler<CreateAttendanceCommand, Result<AttendanceDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateAttendanceHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<AttendanceDto>> Handle(CreateAttendanceCommand request, CancellationToken cancellationToken)
        {
            var status = string.IsNullOrWhiteSpace(request.Status) ? "present" : request.Status;
            if (!AttendanceRecord.ValidStatuses.Contains(status))
                return Result<AttendanceDto>.Failure(
                    $"Status must be one of: {string.Join(", ", AttendanceRecord.ValidStatuses)}.");

            try
            {
                var record = status == "absent"
                    ? AttendanceRecord.Absent(request.PropertyId, request.UserId, request.UserName, request.CheckIn)
                    : new AttendanceRecord(request.PropertyId, request.UserId, request.UserName, request.CheckIn);

                if (status == "late")
                    record.MarkLate();
                else if (status == "on_leave")
                    record.MarkOnLeave(null);

                if (request.Notes is not null)
                    record.SetNotes(request.Notes);

                _context.AttendanceRecords.Add(record);
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
}
