using System;
using System.Collections.Generic;
using System.Linq;
using Aquri.Domain.Entities;

namespace Aquri.Application.Users
{
    /// <summary>User account as returned by the API. The PBKDF2 password hash is intentionally never projected — authentication material never crosses the application boundary.</summary>
    public class UserDto
    {
        public int Id { get; init; }
        public string Email { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Role { get; init; } = string.Empty;
        public string? Department { get; init; }
        public string? Phone { get; init; }

        /// <summary>Primary property of the account; null = unrestricted admin.</summary>
        public int? PropertyId { get; init; }

        /// <summary>Every property the account may work in. Empty for admins.</summary>
        public List<int> PropertyIds { get; init; } = new();

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
            PropertyIds = user.PropertyAssignments.Select(a => a.PropertyId).OrderBy(id => id).ToList(),
            Created = user.Created,
            LastModified = user.LastModified
        };
    }
}
