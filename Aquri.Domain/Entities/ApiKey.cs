using System;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Entities
{
    /// <summary>API key for programmatic access. The raw key is shown once at creation; thereafter only the hash is stored.</summary>
    public class ApiKey
    {
        public int Id { get; private set; }

        /// <summary>User-facing name for the key (e.g. "QuickBooks sync", "Channel manager").</summary>
        public string Name { get; private set; } = string.Empty;

        /// <summary>First 8 chars + suffix, safe to display in UI.</summary>
        public string Prefix { get; private set; } = string.Empty;

        /// <summary>BCrypt hash of the raw key. Never stores plaintext.</summary>
        public string KeyHash { get; private set; } = string.Empty;

        /// <summary>Owner of the key. All API calls made with this key are scoped to the owner's property set.</summary>
        public int UserId { get; private set; }

        /// <summary>Optional property scope. Null = key inherits the owner's full scope (all assigned properties).</summary>
        public int? PropertyId { get; private set; }

        /// <summary>Optional expiry. Null = no expiry.</summary>
        public DateTime? ExpiresAt { get; private set; }

        public bool IsActive { get; private set; } = true;

        public DateTime? LastUsedAt { get; private set; }

        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public ApiKey() { }

        public ApiKey(string name, string prefix, string keyHash, int userId, int? propertyId = null, DateTime? expiresAt = null)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Key name cannot be empty.", nameof(name));
            if (string.IsNullOrWhiteSpace(prefix))
                throw new ArgumentException("Key prefix cannot be empty.", nameof(prefix));
            if (string.IsNullOrWhiteSpace(keyHash))
                throw new ArgumentException("Key hash cannot be empty.", nameof(keyHash));
            if (userId <= 0)
                throw new ArgumentException("UserId must be positive.", nameof(userId));
            if (propertyId.HasValue && propertyId.Value <= 0)
                throw new ArgumentException("PropertyId must be positive when supplied.", nameof(propertyId));
            if (expiresAt.HasValue && expiresAt.Value <= DateTime.UtcNow)
                throw new ArgumentException("Expiry must be in the future.", nameof(expiresAt));

            Name = name.Trim();
            Prefix = prefix.Trim();
            KeyHash = keyHash.Trim();
            UserId = userId;
            PropertyId = propertyId;
            ExpiresAt = expiresAt;
            IsActive = true;
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public void Deactivate()
        {
            if (!IsActive)
                throw new DomainException("API key is already inactive.");
            IsActive = false;
            LastModified = DateTime.UtcNow;
        }

        public void RecordUsage()
        {
            LastUsedAt = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public void UpdateExpiry(DateTime? newExpiry)
        {
            if (newExpiry.HasValue && newExpiry.Value <= DateTime.UtcNow)
                throw new ArgumentException("Expiry must be in the future.", nameof(newExpiry));
            ExpiresAt = newExpiry;
            LastModified = DateTime.UtcNow;
        }

        public bool IsExpired() =>
            ExpiresAt.HasValue && ExpiresAt.Value <= DateTime.UtcNow;

        public bool CanAccessProperty(int propertyId) =>
            PropertyId is null || PropertyId == propertyId;
    }
}
