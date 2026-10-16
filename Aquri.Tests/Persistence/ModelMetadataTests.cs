using System.Linq;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests.Persistence
{
    /// <summary>
    /// The InMemory test provider enforces neither unique indexes nor partial
    /// filters, so these assertions pin the PostgreSQL model directly from EF
    /// metadata: invariants that exist only at the database level must still be
    /// visible here, or a regression would ship silently.
    /// </summary>
    public class ModelMetadataTests
    {
        private static AquriDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .UseInMemoryDatabase($"model-metadata-{System.Guid.NewGuid()}")
                .Options;

            return new AquriDbContext(options);
        }

        [Fact]
        public void RfidTag_Number_Is_Unique_Per_Property_But_Only_For_Active_Tags()
        {
            using var context = CreateContext();

            var index = context.Model.FindEntityType(typeof(RfidTag))!
                .GetIndexes()
                .Single(i => i.IsUnique &&
                             i.Properties.Select(p => p.Name).SequenceEqual(new[] { "PropertyId", "TagNumber" }));

            // Recycled/revoked UIDs may be re-issued (the handler reuses the
            // row), so the constraint must be a partial index over active tags
            // only — a full unique index would 500 on every re-issue.
            index.GetFilter().Should().NotBeNull();
            index.GetFilter().Should().Contain("'active'");
        }

        [Fact]
        public void User_Email_Is_Unique()
        {
            using var context = CreateContext();

            var index = context.Model.FindEntityType(typeof(User))!
                .GetIndexes()
                .Single(i => i.IsUnique && i.Properties.Any(p => p.Name == "Email"));

            index.IsUnique.Should().BeTrue();
        }
    }
}
