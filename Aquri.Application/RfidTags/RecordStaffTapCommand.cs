using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.RfidTags
{
    /// <summary>
    /// Staff badge tap: toggles today's attendance — opens a record if none is
    /// running, clocks out the latest open one if there is.
    /// </summary>
    public record RecordStaffTapCommand(
        int PropertyId,
        string TagNumber,
        DateTime? TappedAt) : IRequest<Result<StaffTapResultDto>>;

    public class RecordStaffTapHandler : IRequestHandler<RecordStaffTapCommand, Result<StaffTapResultDto>>
    {
        private readonly IApplicationDbContext _context;

        public RecordStaffTapHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<StaffTapResultDto>> Handle(RecordStaffTapCommand request, CancellationToken cancellationToken)
        {
            var tagNumber = request.TagNumber?.Trim() ?? string.Empty;
            var tag = await _context.RfidTags
                .FirstOrDefaultAsync(
                    t => t.PropertyId == request.PropertyId && t.TagNumber == tagNumber,
                    cancellationToken);

            if (tag is null)
                return Result<StaffTapResultDto>.NotFoundResult();

            if (tag.Kind != RfidTagKind.Staff)
                return Result<StaffTapResultDto>.Failure("Tag is not a staff badge.");

            var tappedAt = request.TappedAt ?? DateTime.UtcNow;
            var previousTap = tag.LastUsed;

            try
            {
                // Throws when the tag is inactive/blocked/expired — the guard before
                // any attendance state is touched. Stamps LastUsed either way so a
                // held badge keeps sliding past the debounce window.
                tag.RecordUse(tappedAt);
            }
            catch (DomainException ex)
            {
                return Result<StaffTapResultDto>.Failure(ex.Message);
            }

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == tag.UserId, cancellationToken);
            if (user is null)
                return Result<StaffTapResultDto>.Failure("The badge's user no longer exists.");

            var openRecord = await _context.AttendanceRecords
                .Where(a => a.UserId == user.Id
                    && a.Date == tappedAt.Date
                    && a.CheckOut == null)
                .OrderByDescending(a => a.CheckIn)
                .FirstOrDefaultAsync(cancellationToken);

            // A second read within 3s of the previous one is the same physical tap
            // (held badge, serial hiccup): report the current punch, don't toggle.
            var isRepeatTap = previousTap.HasValue
                && tappedAt - previousTap.Value < TimeSpan.FromSeconds(3);

            string punch;
            AttendanceRecord record;

            if (isRepeatTap)
            {
                if (openRecord is not null)
                {
                    punch = "in";
                    record = openRecord;
                }
                else
                {
                    record = await _context.AttendanceRecords
                        .Where(a => a.UserId == user.Id && a.Date == tappedAt.Date)
                        .OrderByDescending(a => a.CheckIn)
                        .FirstOrDefaultAsync(cancellationToken);

                    if (record is not null)
                    {
                        punch = "out";
                    }
                    else
                    {
                        record = new AttendanceRecord(request.PropertyId, user.Id, user.Name, tappedAt);
                        _context.AttendanceRecords.Add(record);
                        punch = "in";
                    }
                }
            }
            else if (openRecord is not null)
            {
                try
                {
                    openRecord.ClockOut(tappedAt);
                }
                catch (Exception ex) when (ex is ArgumentException or DomainException)
                {
                    return Result<StaffTapResultDto>.Failure(ex.Message);
                }

                punch = "out";
                record = openRecord;
            }
            else
            {
                record = new AttendanceRecord(request.PropertyId, user.Id, user.Name, tappedAt);
                _context.AttendanceRecords.Add(record);
                punch = "in";
            }

            await _context.SaveChangesAsync(cancellationToken);

            return Result<StaffTapResultDto>.SuccessResult(new StaffTapResultDto
            {
                Punch = punch,
                AttendanceId = record.Id,
                UserId = user.Id,
                UserName = user.Name,
                TagNumber = tag.TagNumber,
                CheckIn = record.CheckIn,
                CheckOut = record.CheckOut
            });
        }
    }
}
