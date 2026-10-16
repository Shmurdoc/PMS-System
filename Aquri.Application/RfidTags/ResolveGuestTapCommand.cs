using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.RfidTags
{
    /// <summary>Guest tag tap: resolves who is tapping and where they are staying. Read-only apart from stamping the tag's last-used time.</summary>
    public record ResolveGuestTapCommand(
        int PropertyId,
        string TagNumber,
        DateTime? TappedAt) : IRequest<Result<GuestTapContextDto>>;

    public class ResolveGuestTapHandler : IRequestHandler<ResolveGuestTapCommand, Result<GuestTapContextDto>>
    {
        private readonly IApplicationDbContext _context;

        public ResolveGuestTapHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<GuestTapContextDto>> Handle(ResolveGuestTapCommand request, CancellationToken cancellationToken)
        {
            var tagNumber = request.TagNumber?.Trim() ?? string.Empty;
            var tag = await _context.RfidTags
                .FirstOrDefaultAsync(
                    t => t.PropertyId == request.PropertyId && t.TagNumber == tagNumber,
                    cancellationToken);

            if (tag is null)
                return Result<GuestTapContextDto>.NotFoundResult();

            if (tag.Kind != RfidTagKind.Guest)
                return Result<GuestTapContextDto>.Failure("Tag is not a guest tag.");

            try
            {
                tag.RecordUse(request.TappedAt ?? DateTime.UtcNow);
            }
            catch (DomainException ex)
            {
                return Result<GuestTapContextDto>.Failure(ex.Message);
            }

            var booking = await _context.Bookings
                .AsNoTracking()
                .Include(b => b.Guest)
                .Include(b => b.Room)
                .FirstOrDefaultAsync(b => b.Id == tag.BookingId, cancellationToken);

            if (booking is null)
                return Result<GuestTapContextDto>.Failure("The tag's booking no longer exists.");

            await _context.SaveChangesAsync(cancellationToken);

            return Result<GuestTapContextDto>.SuccessResult(new GuestTapContextDto
            {
                TagId = tag.Id,
                TagNumber = tag.TagNumber,
                AccessLevel = tag.AccessLevel,
                ExpiresAt = tag.ExpiresAt,
                BookingId = booking.Id,
                GuestId = booking.GuestId,
                GuestName = booking.Guest?.Name ?? string.Empty,
                RoomId = booking.RoomId,
                RoomNumber = booking.Room?.Number ?? string.Empty,
                BookingStatus = booking.Status.ToWire(),
                CheckIn = booking.CheckIn,
                CheckOut = booking.CheckOut
            });
        }
    }
}
