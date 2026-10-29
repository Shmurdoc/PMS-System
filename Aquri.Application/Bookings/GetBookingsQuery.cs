using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Bookings
{
    public record GetBookingQuery(int Id) : IRequest<Result<BookingDto>>;

    public class GetBookingHandler : IRequestHandler<GetBookingQuery, Result<BookingDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public GetBookingHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<BookingDto>> Handle(GetBookingQuery request, CancellationToken cancellationToken)
        {
            IQueryable<Booking> query = _context.Bookings
                .AsNoTracking()
                .Include(b => b.Guest)
                .Include(b => b.Room);

            // Defense in depth: a scoped caller may only read their own property's
            // bookings, so probing another property's booking Id returns 404.
            if (_currentUser.UserRole != AppRoles.Admin && _currentUser.PropertyIds.Count > 0)
                query = query.Where(b => _currentUser.PropertyIds.Contains(b.PropertyId));

            var booking = await query.FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

            return booking is null
                ? Result<BookingDto>.NotFoundResult()
                : Result<BookingDto>.SuccessResult(BookingDto.FromEntity(booking));
        }
    }

    public record GetBookingsQuery(int PropertyId, string? Status, int Page = 1, int PageSize = 50) : IRequest<PagedRows<BookingDto>>;

    public class GetBookingsHandler : IRequestHandler<GetBookingsQuery, PagedRows<BookingDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public GetBookingsHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<PagedRows<BookingDto>> Handle(GetBookingsQuery request, CancellationToken cancellationToken)
        {
            var page = Math.Clamp(request.Page, 1, int.MaxValue);
            var pageSize = Math.Clamp(request.PageSize, 1, 200);

            var query = _context.Bookings
                .AsNoTracking()
                .Include(b => b.Guest)
                .Include(b => b.Room)
                .Where(b => b.PropertyId == request.PropertyId);

            // Defense in depth: a scoped caller may only read their own property's
            // bookings, even if they supply a different PropertyId in the request.
            if (_currentUser.UserRole != AppRoles.Admin && _currentUser.PropertyIds.Count > 0)
                query = query.Where(b => _currentUser.PropertyIds.Contains(b.PropertyId));

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                if (!BookingStatusExtensions.TryParseWire(request.Status, out var statusFilter))
                    return new PagedRows<BookingDto>();

                query = query.Where(b => b.Status == statusFilter);
            }

            var totalCount = await query.CountAsync(cancellationToken);
            var bookings = await query
                .OrderByDescending(b => b.CheckIn)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new PagedRows<BookingDto>
            {
                Data = bookings.Select(BookingDto.FromEntity).ToList(),
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }
    }
}
