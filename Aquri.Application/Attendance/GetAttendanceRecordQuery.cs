using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Attendance
{
    /// <summary>Fetches one attendance record by id.</summary>
    public record GetAttendanceRecordQuery(int Id) : IRequest<Result<AttendanceDto>>;

    public class GetAttendanceRecordHandler : IRequestHandler<GetAttendanceRecordQuery, Result<AttendanceDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetAttendanceRecordHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<AttendanceDto>> Handle(GetAttendanceRecordQuery request, CancellationToken cancellationToken)
        {
            var record = await _context.AttendanceRecords
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

            return record is null
                ? Result<AttendanceDto>.NotFoundResult()
                : Result<AttendanceDto>.SuccessResult(AttendanceDto.FromEntity(record));
        }
    }

    /// <summary>Lists attendance records, optionally filtered by property, staff member, date, and status.</summary>
    public record GetAttendanceRecordsQuery(int? PropertyId, int? UserId, DateTime? Date, string? Status) : IRequest<List<AttendanceDto>>;

    public class GetAttendanceRecordsHandler : IRequestHandler<GetAttendanceRecordsQuery, List<AttendanceDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetAttendanceRecordsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<AttendanceDto>> Handle(GetAttendanceRecordsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.AttendanceRecords.AsNoTracking().AsQueryable();

            if (request.PropertyId.HasValue)
                query = query.Where(a => a.PropertyId == request.PropertyId.Value);
            if (request.UserId.HasValue)
                query = query.Where(a => a.UserId == request.UserId.Value);
            if (request.Date.HasValue)
            {
                var day = request.Date.Value.Date;
                query = query.Where(a => a.Date == day);
            }
            if (!string.IsNullOrWhiteSpace(request.Status))
                query = query.Where(a => a.Status == request.Status);

            var records = await query
                .OrderByDescending(a => a.Date)
                .ThenBy(a => a.UserName)
                .ToListAsync(cancellationToken);

            return records.Select(AttendanceDto.FromEntity).ToList();
        }
    }
}
