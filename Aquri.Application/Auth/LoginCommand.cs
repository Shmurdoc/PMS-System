using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Auth
{
    /// <summary>
    /// Authenticates a user by email + password and returns a signed JWT
    /// plus the basic profile. Never reveals which credential was wrong.
    /// </summary>
    public record LoginCommand(string Email, string Password) : IRequest<Result<LoginResponseDto>>;

    public class LoginHandler : IRequestHandler<LoginCommand, Result<LoginResponseDto>>
    {
        // Verified against when the email is unknown, so both failure paths run
        // exactly one PBKDF2 verify and take the same time.
        private static string? _timingDecoyHash;

        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly ITokenService _tokenService;

        public LoginHandler(
            IApplicationDbContext context,
            IPasswordHasher passwordHasher,
            ITokenService tokenService)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _tokenService = tokenService;
        }

        public async Task<Result<LoginResponseDto>> Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
                return Result<LoginResponseDto>.Failure("Email and password are required.");

            var email = request.Email.Trim().ToLowerInvariant();

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email, cancellationToken);

            var hashToVerify = user?.PasswordHash
                ?? (_timingDecoyHash ??= _passwordHasher.Hash("timing-decoy"));
            var passwordOk = _passwordHasher.Verify(request.Password, hashToVerify);

            if (user is null || !passwordOk)
                return Result<LoginResponseDto>.Failure("Invalid email or password.");

            var token = _tokenService.CreateToken(user);

            return Result<LoginResponseDto>.SuccessResult(new LoginResponseDto
            {
                Token = token,
                User = UserDto.FromEntity(user)
            });
        }
    }
}
