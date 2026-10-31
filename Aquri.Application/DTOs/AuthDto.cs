using System;
using Aquri.Application.Users;

namespace Aquri.Application.DTOs
{
    /// <summary>Login credentials sent by the frontend.</summary>
    public class LoginRequestDto
    {
        public string Email { get; init; } = string.Empty;
        public string Password { get; init; } = string.Empty;
    }

    /// <summary>Successful login response: JWT + basic profile.</summary>
    public class LoginResponseDto
    {
        public string Token { get; init; } = string.Empty;

        /// <summary>Same shape the users endpoints return, so the client has one profile type.</summary>
        public UserDto User { get; init; } = new();
    }
}
