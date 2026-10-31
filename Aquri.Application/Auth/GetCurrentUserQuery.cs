using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Auth
{
    /// <summary>Fetches the profile for the currently authenticated user (id taken from the JWT's NameIdentifier claim by the controller).</summary>
    public record GetCurrentUserQuery(int UserId) : IRequest<Result<UserDto>>;

    public class GetCurrentUserHandler : IRequestHandler<GetCurrentUserQuery, Result<UserDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetCurrentUserHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Result<UserDto>> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .Include(u => u.PropertyAssignments)
                .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

            if (user is null)
                return Result<UserDto>.NotFoundResult();

            return Result<UserDto>.SuccessResult(UserDto.FromEntity(user));
        }
    }
}
