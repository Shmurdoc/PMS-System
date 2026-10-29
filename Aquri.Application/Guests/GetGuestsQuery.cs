using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Guests
{
    public record GetGuestQuery(int Id) : IRequest<Result<GuestDto>>;

    public class GetGuestHandler : IRequestHandler<GetGuestQuery, Result<GuestDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public GetGuestHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<GuestDto>> Handle(GetGuestQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Guests.AsNoTracking();

            // Defense in depth: a scoped caller may only read their own property's
            // guests, so probing another property's guest Id returns 404.
            if (_currentUser.UserRole != AppRoles.Admin && _currentUser.PropertyIds.Count > 0)
                query = query.Where(g => _currentUser.PropertyIds.Contains(g.PropertyId));

            var guest = await query
                .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);

            return guest is null
                ? Result<GuestDto>.NotFoundResult()
                : Result<GuestDto>.SuccessResult(GuestDto.FromEntity(guest));
        }
    }

    public record GetGuestsQuery(string? Search, int Page = 1, int PageSize = 50) : IRequest<PagedRows<GuestDto>>;

    public class GetGuestsHandler : IRequestHandler<GetGuestsQuery, PagedRows<GuestDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public GetGuestsHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<PagedRows<GuestDto>> Handle(GetGuestsQuery request, CancellationToken cancellationToken)
        {
            var page = Math.Clamp(request.Page, 1, int.MaxValue);
            var pageSize = Math.Clamp(request.PageSize, 1, 200);

            var query = _context.Guests.AsNoTracking().AsQueryable();

            // Defense in depth: a scoped caller may only read their own property's
            // guests, even if they supply a different PropertyId in the request.
            if (_currentUser.UserRole != AppRoles.Admin && _currentUser.PropertyIds.Count > 0)
                query = query.Where(g => _currentUser.PropertyIds.Contains(g.PropertyId));

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var term = request.Search.Trim().ToLower();
                query = query.Where(g =>
                    g.Name.ToLower().Contains(term) ||
                    g.Email.ToLower().Contains(term));
            }

            var totalCount = await query.CountAsync(cancellationToken);
            var guests = await query
                .OrderBy(g => g.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new PagedRows<GuestDto>
            {
                Data = guests.Select(GuestDto.FromEntity).ToList(),
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }
    }
}
