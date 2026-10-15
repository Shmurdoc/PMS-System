using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.RfidTags
{
    /// <summary>
    /// Issues a tag: staff badges bind to a user, guest tags bind to a booking.
    /// Exactly one binding is set; the other is derived or rejected.
    /// </summary>
    public record IssueRfidTagCommand(
        int PropertyId,
        string Kind,
        string TagNumber,
        int? UserId,
        int? BookingId,
        string? AccessLevel,
        DateTime? ExpiresAt,
        string? Notes) : IRequest<Result<RfidTagDto>>;

    public class IssueRfidTagHandler : IRequestHandler<IssueRfidTagCommand, Result<RfidTagDto>>
    {
        private readonly IApplicationDbContext _context;

        public IssueRfidTagHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<RfidTagDto>> Handle(IssueRfidTagCommand request, CancellationToken cancellationToken)
        {
            if (!RfidTagKindExtensions.TryParseWire(request.Kind, out var kind))
                return Result<RfidTagDto>.Failure("Kind must be 'guest' or 'staff'.");

            var tagNumber = request.TagNumber?.Trim() ?? string.Empty;
            if (tagNumber.Length == 0)
                return Result<RfidTagDto>.Failure("Tag number cannot be empty.");

            var duplicate = await _context.RfidTags.AnyAsync(
                t => t.PropertyId == request.PropertyId && t.TagNumber == tagNumber,
                cancellationToken);
            if (duplicate)
                return Result<RfidTagDto>.ConflictResult($"Tag '{tagNumber}' is already issued at this property.");

            try
            {
                if (kind == RfidTagKind.Staff)
                {
                    if (!request.UserId.HasValue)
                        return Result<RfidTagDto>.Failure("A staff tag needs a UserId.");

                    var user = await _context.Users
                        .AsNoTracking()
                        .FirstOrDefaultAsync(u => u.Id == request.UserId.Value, cancellationToken);
                    if (user is null)
                        return Result<RfidTagDto>.Failure($"User {request.UserId} not found.");

                    var staffTag = RfidTag.ForStaff(
                        request.PropertyId, user.Id, tagNumber, request.AccessLevel ?? "staff");
                    staffTag.SetNotes(request.Notes);

                    _context.RfidTags.Add(staffTag);
                    await _context.SaveChangesAsync(cancellationToken);
                    return Result<RfidTagDto>.SuccessResult(RfidTagDto.FromEntity(staffTag, user.Name));
                }
                else
                {
                    if (!request.BookingId.HasValue)
                        return Result<RfidTagDto>.Failure("A guest tag needs a BookingId.");

                    var booking = await _context.Bookings
                        .AsNoTracking()
                        .Include(b => b.Guest)
                        .Include(b => b.Room)
                        .FirstOrDefaultAsync(b => b.Id == request.BookingId.Value, cancellationToken);
                    if (booking is null)
                        return Result<RfidTagDto>.Failure($"Booking {request.BookingId} not found.");
                    if (booking.PropertyId != request.PropertyId)
                        return Result<RfidTagDto>.Failure("Booking belongs to a different property.");

                    var guestTag = RfidTag.ForGuest(
                        request.PropertyId, booking.Id, tagNumber,
                        request.ExpiresAt ?? booking.CheckOut);
                    guestTag.SetNotes(request.Notes);

                    _context.RfidTags.Add(guestTag);
                    await _context.SaveChangesAsync(cancellationToken);
                    return Result<RfidTagDto>.SuccessResult(RfidTagDto.FromEntity(
                        guestTag, null, booking.Guest?.Name, booking.Room?.Number));
                }
            }
            catch (ArgumentException ex)
            {
                return Result<RfidTagDto>.Failure(ex.Message);
            }
        }
    }
}
