using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Guests
{
    /// <summary>Fetches one guest by id.</summary>
    public record GetGuestQuery(int Id) : IRequest<Result<GuestDto>>;

    public class GetGuestHandler : IRequestHandler<GetGuestQuery, Result<GuestDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetGuestHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<GuestDto>> Handle(GetGuestQuery request, CancellationToken cancellationToken)
        {
            var guest = await _context.Guests
                .AsNoTracking()
                .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);

            return guest is null
                ? Result<GuestDto>.NotFoundResult()
                : Result<GuestDto>.SuccessResult(GuestDto.FromEntity(guest));
        }
    }

    /// <summary>Lists guests, optionally filtered by name/email search term.</summary>
    public record GetGuestsQuery(string? Search) : IRequest<List<GuestDto>>;

    public class GetGuestsHandler : IRequestHandler<GetGuestsQuery, List<GuestDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetGuestsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<GuestDto>> Handle(GetGuestsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Guests.AsNoTracking().AsQueryable();

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
