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
            if (_currentUser.UserRole != AppRoles.Admin && _currentUser.PropertyId is int scope)
                query = query.Where(g => g.PropertyId == scope);

            var guest = await query
                .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);

            return guest is null
                ? Result<GuestDto>.NotFoundResult()
                : Result<GuestDto>.SuccessResult(GuestDto.FromEntity(guest));
        }
    }

    public record GetGuestsQuery(string? Search) : IRequest<List<GuestDto>>;

    public class GetGuestsHandler : IRequestHandler<GetGuestsQuery, List<GuestDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public GetGuestsHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<List<GuestDto>> Handle(GetGuestsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Guests.AsNoTracking().AsQueryable();

            // Defense in depth: a scoped caller may only read their own property's
            // guests, even if they supply a different PropertyId in the request.
            if (_currentUser.UserRole != AppRoles.Admin && _currentUser.PropertyId is int scope)
                query = query.Where(g => g.PropertyId == scope);

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var term = request.Search.Trim().ToLower();
                query = query.Where(g =>
                    g.Name.ToLower().Contains(term) ||
                    g.Email.ToLower().Contains(term));
            }

            var guests = await query.OrderBy(g => g.Name).ToListAsync(cancellationToken);
            return guests.Select(GuestDto.FromEntity).ToList();
        }
    }
}
