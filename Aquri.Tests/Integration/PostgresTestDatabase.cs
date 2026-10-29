using Aquri.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests.Integration;

[CollectionDefinition("postgres", DisableParallelization = true)]
public sealed class PostgresCollection : ICollectionFixture<PostgresTestDatabase>
{
}

/// <summary>
/// Shared harness for the PostgreSQL-only money guarantees (booking overlap
/// exclusion constraint, payment idempotency index). Creates the schema by
/// running the real EF migrations, and cleans the tables between tests so the
/// suite is re-runnable. When Postgres is unreachable the tests report
/// themselves as skipped instead of failing, so CI without a database service
/// stays green.
/// </summary>
public sealed class PostgresTestDatabase : IDisposable
{
    private const string InMemoryProvider = "Microsoft.EntityFrameworkCore.InMemory";

    public bool Available { get; }

    public AquriDbContext NewContext() => new(new DbContextOptionsBuilder<AquriDbContext>()
        .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory, Aquri.Infrastructure.Persistence.PropertyScopeModelCacheKeyFactory>()
        .UseNpgsql(ConnectionString)
        .Options);

    private string ConnectionString =>
        Environment.GetEnvironmentVariable("ConnectionStrings__PostgresTests")
        ?? throw new InvalidOperationException("ConnectionStrings__PostgresTests is not set.");

    public PostgresTestDatabase()
    {
        Available = false;
        string? reason = null;
        try
        {
            using var probe = NewContext();
            if (probe.Database.ProviderName == InMemoryProvider)
            {
                reason = "this context was configured as InMemory, not PostgreSQL";
                return;
            }
            probe.Database.OpenConnection();
            probe.Database.Migrate();
            Available = true;
        }
        catch (Exception ex)
        {
            reason = ex.Message;
        }

        if (reason is not null)
        {
            // In CI the postgres service must be up; a silent skip would let a
            // broken money guarantee pass. Opt in with AQURI_REQUIRE_POSTGRES=1.
            if (Environment.GetEnvironmentVariable("AQURI_REQUIRE_POSTGRES") == "1")
                throw new InvalidOperationException($"PostgreSQL is required but unavailable: {reason}");

            Console.WriteLine($"[postgres] SKIPPED: {reason}");
        }
    }

    /// <summary>Wipes the tables this suite touches so tests are repeatable.</summary>
    public void ClearTables()
    {
        using var ctx = NewContext();
        ctx.Database.ExecuteSqlRaw(
            """TRUNCATE TABLE "Payments", "Bookings", "Invoices", "InvoiceItems", "AuditLogs", "Rooms", "Guests", "Users", "Properties" CASCADE;""");
    }

    public void Dispose()
    {
        // Nothing to clean up: migrations stay applied for the next run.
    }
}
