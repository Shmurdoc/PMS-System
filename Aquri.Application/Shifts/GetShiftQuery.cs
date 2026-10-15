using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Shifts
{
    /// <summary>Fetches one shift by id.</summary>
    public record GetShiftQuery(int Id) : IRequest<Result<ShiftDto>>;

    public class GetShiftHandler : IRequestHandler<GetShiftQuery, Result<ShiftDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetShiftHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<ShiftDto>> Handle(GetShiftQuery request, CancellationToken cancellationToken)
        {
            var shift = await _context.Shifts
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

            return shift is null
                ? Result<ShiftDto>.NotFoundResult()
                : Result<ShiftDto>.SuccessResult(ShiftDto.FromEntity(shift));
        }
    }

    /// <summary>Lists shifts, optionally filtered by property, staff member, date, and status.</summary>
    public record GetShiftsQuery(int? PropertyId, int? UserId, DateTime? Date, string? Status) : IRequest<List<ShiftDto>>;

    public class GetShiftsHandler : IRequestHandler<GetShiftsQuery, List<ShiftDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetShiftsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<ShiftDto>> Handle(GetShiftsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Shifts.AsNoTracking().AsQueryable();

            if (request.PropertyId.HasValue)
                query = query.Where(s => s.PropertyId == request.PropertyId.Value);
            if (request.UserId.HasValue)
                query = query.Where(s => s.UserId == request.UserId.Value);
            if (request.Date.HasValue)
            {
                var day = request.Date.Value.Date;
                query = query.Where(s => s.Date == day);
            }
            if (!string.IsNullOrWhiteSpace(request.Status))
                query = query.Where(s => s.Status == request.Status);

            var shifts = await query
                .OrderBy(s => s.Date)
                .ThenBy(s => s.StartTime)
                .ToListAsync(cancellationToken);

            return shifts.Select(ShiftDto.FromEntity).ToList();
        }
    }
}
