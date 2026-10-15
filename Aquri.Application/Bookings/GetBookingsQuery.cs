using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Bookings
{
    /// <summary>Fetches one booking by id.</summary>
    public record GetBookingQuery(int Id) : IRequest<Result<BookingDto>>;

    public class GetBookingHandler : IRequestHandler<GetBookingQuery, Result<BookingDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetBookingHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<BookingDto>> Handle(GetBookingQuery request, CancellationToken cancellationToken)
        {
            var booking = await _context.Bookings
                .AsNoTracking()
                .Include(b => b.Guest)
                .Include(b => b.Room)
                .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

            return booking is null
                ? Result<BookingDto>.NotFoundResult()
                : Result<BookingDto>.SuccessResult(BookingDto.FromEntity(booking));
        }
    }

    /// <summary>Lists bookings for a property with optional status filter.</summary>
    public record GetBookingsQuery(int PropertyId, string? Status) : IRequest<List<BookingDto>>;

    public class GetBookingsHandler : IRequestHandler<GetBookingsQuery, List<BookingDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetBookingsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<BookingDto>> Handle(GetBookingsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Bookings
                .AsNoTracking()
                .Where(b => b.PropertyId == request.PropertyId);

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                if (!BookingStatusExtensions.TryParseWire(request.Status, out var statusFilter))
                    return new List<BookingDto>();

                query = query.Where(b => b.Status == statusFilter);
            }

            var bookings = await query
                .Include(b => b.Guest)
                .Include(b => b.Room)
                .OrderByDescending(b => b.CheckIn)
                .ToListAsync(cancellationToken);

            return bookings.Select(BookingDto.FromEntity).ToList();
        }
    }
}
