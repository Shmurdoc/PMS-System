using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Users
{
    public record GetUserQuery(int Id) : IRequest<Result<UserDto>>;

    public class GetUserHandler : IRequestHandler<GetUserQuery, Result<UserDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public GetUserHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<UserDto>> Handle(GetUserQuery request, CancellationToken cancellationToken)
        {
            // Defense in depth: the EF global query filter already confines a
            // scoped account to its own property, but we filter here too so a
            // scoped caller cannot probe for another property's staff by ID.
            var query = _context.Users.AsNoTracking().AsQueryable();
            if (_currentUser.UserRole != AppRoles.Admin && _currentUser.PropertyId is int scope)
                query = query.Where(u => u.PropertyId == scope);

            var user = await query.FirstOrDefaultAsync(u => u.Id == request.Id, cancellationToken);

            return user is null
                ? Result<UserDto>.NotFoundResult()
                : Result<UserDto>.SuccessResult(UserDto.FromEntity(user));
        }
    }

    public record GetUsersQuery(string? Search, int Page = 1, int PageSize = 50) : IRequest<PagedResult<UserDto>>;

    public class GetUsersHandler : IRequestHandler<GetUsersQuery, PagedResult<UserDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public GetUsersHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<PagedResult<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
        {
            var page = Math.Clamp(request.Page, 1, int.MaxValue);
            var pageSize = Math.Clamp(request.PageSize, 1, 200);

            var query = _context.Users.AsNoTracking().AsQueryable();

            // Defense in depth: the EF global query filter already confines a
            // scoped account to its own property, but we filter here too so the
            // roster never leaks across properties if the filter is bypassed.
            // Admins see everyone; managers and front desk see only their own
            // property's colleagues (needed for staff messaging).
            if (_currentUser.UserRole != AppRoles.Admin && _currentUser.PropertyId is int scope)
                query = query.Where(u => u.PropertyId == scope);

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var term = request.Search.Trim().ToLower();
                query = query.Where(u =>
                    u.Name.ToLower().Contains(term) ||
                    u.Email.ToLower().Contains(term) ||
                    u.Role.ToLower().Contains(term));
            }

            var totalCount = await query.CountAsync(cancellationToken);
            var users = await query
                .OrderBy(u => u.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new PagedResult<UserDto>
            {
                Data = users.Select(UserDto.FromEntity).ToList(),
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }
    }
}
