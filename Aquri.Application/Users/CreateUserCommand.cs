using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Users
{
    /// <summary>Shared password rules for account creation and admin password resets.</summary>
    public static class UserRules
    {
        public const int MinPasswordLength = 8;
    }

    /// <summary>Creates a staff account (admin only). The plaintext password is hashed before storage.</summary>
    public record CreateUserCommand(
        string Email,
        string Name,
        string Password,
        string Role,
        string? Department,
        string? Phone) : IRequest<Result<UserDto>>;

    public class CreateUserHandler : IRequestHandler<CreateUserCommand, Result<UserDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;

        public CreateUserHandler(IApplicationDbContext context, IPasswordHasher passwordHasher)
        {
            _context = context;
            _passwordHasher = passwordHasher;
        }

        public async Task<Result<UserDto>> Handle(CreateUserCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
                return Result<UserDto>.Failure("Email cannot be null or empty.");
            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < UserRules.MinPasswordLength)
                return Result<UserDto>.Failure($"Password must be at least {UserRules.MinPasswordLength} characters.");
            if (string.IsNullOrWhiteSpace(request.Role) || !AppRoles.IsValid(request.Role))
                return Result<UserDto>.Failure($"Role must be one of: {string.Join(", ", AppRoles.All)}.");

            // Unique login identity — proactive check so the invariant holds on
            // every provider (the InMemory test provider does not enforce the
            // unique email index; PostgreSQL does and the middleware maps
            // DbUpdateException to 409 as a backstop).
            var email = request.Email.Trim();
            var emailTaken = await _context.Users
                .AnyAsync(u => u.Email.ToLower() == email.ToLower(), cancellationToken);
            if (emailTaken)
                return Result<UserDto>.ConflictResult("A user with this email already exists.");

            try
            {
                var user = new User(
                    email,
                    request.Name,
                    request.Role,
                    _passwordHasher.Hash(request.Password));

                if (!string.IsNullOrWhiteSpace(request.Department) || !string.IsNullOrWhiteSpace(request.Phone))
                    user.UpdateProfile(request.Name, request.Department, request.Phone);

                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<UserDto>.SuccessResult(UserDto.FromEntity(user));
            }
            catch (ArgumentException ex)
            {
                return Result<UserDto>.Failure(ex.Message);
            }
        }
    }
}
