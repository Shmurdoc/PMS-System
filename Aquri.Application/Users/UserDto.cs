using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.Users
{
    /// <summary>
    /// User account as returned by the API. The PBKDF2 password hash is
    /// intentionally never projected — authentication material never
    /// crosses the application boundary.
    /// </summary>
    public class UserDto
    {
        public int Id { get; init; }
        public string Email { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Role { get; init; } = string.Empty;
        public string? Department { get; init; }
        public string? Phone { get; init; }

        /// <summary>Property scope of the account; null = unrestricted.</summary>
        public int? PropertyId { get; init; }

        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static UserDto FromEntity(User user) => new()
        {
            Id = user.Id,
            Email = user.Email,
            Name = user.Name,
            Role = user.Role,
            Department = user.Department,
            Phone = user.Phone,
            PropertyId = user.PropertyId,
            Created = user.Created,
            LastModified = user.LastModified
        };
    }
}
