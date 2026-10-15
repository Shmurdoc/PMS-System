using System;
using Aquri.Tests.Builders;

namespace Aquri.Tests.Builders
{
    /// <summary>
    /// Builder for creating test Aquri entities with configurable properties.
    /// Uses the FakeTimeProvider for deterministic time values.
    /// </summary>
    public static class EntityBuilder
    {
        /// <summary>
        /// Creates a fake DateTime using the fake time provider
        /// </summary>
        /// <param name="timeProvider">The fake time provider</param>
        /// <returns>A fake DateTime</returns>
        public static DateTime CreateFakeDateTime(this FakeTimeProvider timeProvider)
        {
            return timeProvider.GetCurrentTime();
        }

        /// <summary>
        /// Creates a fake Guid for testing
        /// </summary>
        /// <returns>A fake Guid</returns>
        public static Guid CreateFakeGuid()
        {
            return Guid.NewGuid();
        }

        /// <summary>
        /// Creates a connection string for test database
        /// </summary>
        /// <param name="timeProvider">Optional fake time provider for expiry calculations</param>
        /// <returns>A test connection string</returns>
        public static string CreateTestConnectionString(FakeTimeProvider? timeProvider = null)
        {
            var baseString = "Host=localhost;Database=Aquri;Username=aquri_user;Password=test-only-local";
            
            if (timeProvider != null)
            {
                // Add time-based expiry if needed
                var expiry = timeProvider.GetCurrentTime().AddYears(1);
                // Could append expiry logic here
            }
            
            return baseString;
        }

        /// <summary>
        /// Creates a fake MinIO bucket name
        /// </summary>
        /// <returns>A fake bucket name</returns>
        public static string CreateFakeBucketName()
        {
            return $"test-bucket-{Guid.NewGuid():N.Substring(0, 8)}";
        }

        /// <summary>
        /// Creates a fake object key for MinIO
        /// </summary>
        /// <returns>A fake object key</returns>
        public static string CreateFakeObjectKey()
        {
            return $"test-object-{Guid.NewGuid():N}.txt";
        }
    }
}
