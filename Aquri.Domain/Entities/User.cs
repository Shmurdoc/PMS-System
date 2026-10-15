using System;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// Application role. Values match the strings used in [Authorize(Roles = "...")]
    /// attributes on API controllers and the frontend's demo role names.
    /// </summary>
    public static class AppRoles
    {
        public const string Admin = "admin";
        public const string Manager = "manager";
        public const string FrontDesk = "front_desk";
        public const string Housekeeping = "housekeeping";
        public const string Maintenance = "maintenance";
        public const string Auditor = "auditor";

        public static readonly string[] All =
        {
            Admin, Manager, FrontDesk, Housekeeping, Maintenance, Auditor
        };

        public static bool IsValid(string role) => Array.IndexOf(All, role) >= 0;
    }

    /// <summary>
    /// User account for authentication and authorization.
    /// Password is stored only as a PBKDF2 hash (never plaintext) — the hash
    /// is produced by the Application layer's IPasswordHasher abstraction.
    /// All mutation goes through methods; no public setters.
    /// </summary>
    public class User
    {
        public int Id { get; private set; }

        /// <summary>Unique login email (case-insensitive).</summary>
        public string Email { get; private set; } = string.Empty;

        /// <summary>Display name.</summary>
        public string Name { get; private set; } = string.Empty;

        /// <summary>Role string — one of <see cref="AppRoles"/>.</summary>
        public string Role { get; private set; } = string.Empty;

        /// <summary>PBKDF2 password hash. Never log or expose this value.</summary>
        public string PasswordHash { get; private set; } = string.Empty;

        public string? Department { get; private set; }

        public string? Phone { get; private set; }

        public DateTime Created { get; private set; }

        public DateTime LastModified { get; private set; }

        /// <summary>EF Core parameterless constructor.</summary>
        public User() { }

        /// <summary>
        /// Creates a new user with a pre-computed password hash.
        /// </summary>
        /// <exception cref="ArgumentException">Thrown when email, name, role, or passwordHash is invalid.</exception>
        public User(string email, string name, string role, string passwordHash)
        {
            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Email cannot be null or empty.", nameof(email));
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name cannot be null or empty.", nameof(name));
            if (string.IsNullOrWhiteSpace(role))
                throw new ArgumentException("Role cannot be null or empty.", nameof(role));
            if (!AppRoles.IsValid(role))
                throw new ArgumentException($"Role must be one of: {string.Join(", ", AppRoles.All)}.", nameof(role));
            if (string.IsNullOrWhiteSpace(passwordHash))
                throw new ArgumentException("Password hash cannot be null or empty.", nameof(passwordHash));

            Email = email.Trim();
            Name = name.Trim();
            Role = role;
            PasswordHash = passwordHash;
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Updates the password hash (after successful re-hash by the hasher).</summary>
        public void SetPasswordHash(string newPasswordHash)
        {
            if (string.IsNullOrWhiteSpace(newPasswordHash))
                throw new ArgumentException("Password hash cannot be null or empty.", nameof(newPasswordHash));

            PasswordHash = newPasswordHash;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Updates profile fields. Role is changed separately via <see cref="ChangeRole"/>.</summary>
        public void UpdateProfile(string name, string? department, string? phone)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name cannot be null or empty.", nameof(name));

            Name = name.Trim();
            Department = department;
            Phone = phone;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Assigns a new role after validating it is a known role.</summary>
        public void ChangeRole(string newRole)
        {
            if (!AppRoles.IsValid(newRole))
                throw new ArgumentException($"Role must be one of: {string.Join(", ", AppRoles.All)}.", nameof(newRole));

            Role = newRole;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Email comparison that ignores case (login lookup).</summary>
        public bool EmailMatches(string email) =>
            !string.IsNullOrWhiteSpace(email) &&
            string.Equals(Email, email.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
