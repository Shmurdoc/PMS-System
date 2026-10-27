using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.DTOs
{
    /// <summary>Public user representation — never exposes PasswordHash.</summary>
    public class UserDto
    {
        public int Id { get; init; }
        public string Email { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Role { get; init; } = string.Empty;
        public int? PropertyId { get; init; }
        public string? Department { get; init; }
        public string? Phone { get; init; }
        public DateTime Created { get; init; }

        public static UserDto FromEntity(User user) => new()
        {
            Id = user.Id,
            Email = user.Email,
            Name = user.Name,
            Role = user.Role,
            PropertyId = user.PropertyId,
            Department = user.Department,
            Phone = user.Phone,
            Created = user.Created
        };
    }

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
        public UserDto User { get; init; } = new();
    }
}
