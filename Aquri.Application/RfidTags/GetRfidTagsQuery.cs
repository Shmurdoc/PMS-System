using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.RfidTags
{
    public record GetRfidTagsQuery(int PropertyId, string? Kind) : IRequest<List<RfidTagDto>>;

    public class GetRfidTagsHandler : IRequestHandler<GetRfidTagsQuery, List<RfidTagDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetRfidTagsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<RfidTagDto>> Handle(GetRfidTagsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.RfidTags
                .AsNoTracking()
                .Where(t => t.PropertyId == request.PropertyId);

            if (!string.IsNullOrWhiteSpace(request.Kind))
            {
                // An unparseable kind is a client bug, not a filter to skip —
                // return nothing rather than silently listing every tag.
                if (!RfidTagKindExtensions.TryParseWire(request.Kind, out var kind))
                    return new List<RfidTagDto>();

                query = query.Where(t => t.Kind == kind);
            }

            var tags = await query
                .OrderByDescending(t => t.Id)
                .ToListAsync(cancellationToken);

            var userIds = tags.Where(t => t.UserId != null).Select(t => t.UserId!.Value).ToList();
            var bookingIds = tags.Where(t => t.BookingId != null).Select(t => t.BookingId!.Value).ToList();

            var users = await _context.Users
                .AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Name })
                .ToDictionaryAsync(u => u.Id, u => u.Name, cancellationToken);

            var bookings = await _context.Bookings
                .AsNoTracking()
                .Include(b => b.Guest)
                .Include(b => b.Room)
                .Where(b => bookingIds.Contains(b.Id))
                .ToListAsync(cancellationToken);

            var bookingNames = bookings.ToDictionary(
                b => b.Id,
                b => (GuestName: b.Guest?.Name, RoomNumber: b.Room?.Number));

            return tags.Select(t =>
            {
                string? userName = t.UserId is int uid && users.TryGetValue(uid, out var name) ? name : null;
                string? guestName = null;
                string? roomNumber = null;

                if (t.BookingId is int bid && bookingNames.TryGetValue(bid, out var names))
                {
                    guestName = names.GuestName;
                    roomNumber = names.RoomNumber;
                }

                return RfidTagDto.FromEntity(t, userName, guestName, roomNumber);
            }).ToList();
        }
    }
}
