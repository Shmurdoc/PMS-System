using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Users
{
    public record GetUserQuery(int Id) : IRequest<Result<UserDto>>;

    public class GetUserHandler : IRequestHandler<GetUserQuery, Result<UserDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetUserHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<UserDto>> Handle(GetUserQuery request, CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == request.Id, cancellationToken);

            return user is null
                ? Result<UserDto>.NotFoundResult()
                : Result<UserDto>.SuccessResult(UserDto.FromEntity(user));
        }
    }

    public record GetUsersQuery(string? Search) : IRequest<List<UserDto>>;

    public class GetUsersHandler : IRequestHandler<GetUsersQuery, List<UserDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetUsersHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Users.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var term = request.Search.Trim().ToLower();
                query = query.Where(u =>
                    u.Name.ToLower().Contains(term) ||
                    u.Email.ToLower().Contains(term) ||
                    u.Role.ToLower().Contains(term));
            }

            var users = await query.OrderBy(u => u.Name).ToListAsync(cancellationToken);
            return users.Select(UserDto.FromEntity).ToList();
        }
    }
}
