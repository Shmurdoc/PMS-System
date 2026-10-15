using System.Text.Json;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using Aquri.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Aquri.Tests.Seeding
{
    /// <summary>
    /// Boots DbSeeder against an isolated InMemory database — covers the granular
    /// per-table guards and the mirrored AI demo data.
    /// </summary>
    public class DbSeederAiTests
    {
        private static ServiceProvider BuildServices()
        {
            var databaseName = $"seeder-tests-{Guid.NewGuid():N}";
            return new ServiceCollection()
                .AddLogging()
                .AddDbContext<AquriDbContext>(options =>
                    options.UseInMemoryDatabase(databaseName))
                .AddScoped<IPasswordHasher, Pbkdf2PasswordHasher>()
                .BuildServiceProvider();
        }

        private static async Task SeedTwiceAsync(IServiceProvider services)
        {
            using (var scope = services.CreateScope())
                await DbSeeder.SeedAsync(scope.ServiceProvider, seedDemoUsers: true);
            using (var scope = services.CreateScope())
                await DbSeeder.SeedAsync(scope.ServiceProvider, seedDemoUsers: true);
        }

        [Fact]
        public async Task Seed_Twice_Yields_Stable_Counts_And_Demo_Users()
        {
            await using var services = BuildServices();
            await SeedTwiceAsync(services);

            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AquriDbContext>();

            db.Users.Count().Should().Be(3);
            db.Users.Select(u => u.Email).Should().Contain("admin@nexus.com");
            db.Agents.Count().Should().Be(6);
            db.AiInsights.Count().Should().Be(5);
            db.Workflows.Count().Should().Be(4);
        }

        [Fact]
        public async Task Agents_Match_Spec_Keys_And_Mock_Statuses()
        {
            await using var services = BuildServices();
            await SeedTwiceAsync(services);

            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AquriDbContext>();
            var agents = db.Agents.ToList();

            agents.Select(a => a.Key).Should().BeEquivalentTo(new[]
            {
                "revenue-optimizer", "guest-predictor", "maintenance-scheduler",
                "rate-analyzer", "staffing-optimizer", "inventory-monitor"
            });

            agents.Single(a => a.Key == "maintenance-scheduler").Status.Should().Be("paused");
            agents.Single(a => a.Key == "staffing-optimizer").Status.Should().Be("stopped");
            agents.Where(a => a.Key is not "maintenance-scheduler" and not "staffing-optimizer")
                .Should().OnlyContain(a => a.Status == "running");
        }

        [Fact]
        public async Task Insights_And_Workflows_Mirror_The_Store_Mocks()
        {
            await using var services = BuildServices();
            await SeedTwiceAsync(services);

            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AquriDbContext>();

            var insights = db.AiInsights.ToList();
            insights.Select(i => i.Title).Should().Contain(new[]
            {
                "Revenue Optimization", "Occupancy Forecast", "Staffing Recommendation",
                "Predictive Maintenance", "Guest Experience"
            });

            var revenue = insights.Single(i => i.Title == "Revenue Optimization");
            revenue.Type.Should().Be("revenue");
            revenue.Impact.Should().Be("high");
            revenue.Recommendation.Should().Contain("weekend rates");

            var workflows = db.Workflows.ToList();
            workflows.Select(w => w.Name).Should().Contain(new[]
            {
                "Guest Check-in Welcome", "Low Inventory Alert",
                "Late Checkout Auto-Extension", "Maintenance Escalation"
            });

            var welcome = workflows.Single(w => w.Name == "Guest Check-in Welcome");
            welcome.Trigger.Should().Be("On check-in");
            welcome.Status.Should().Be("active");
            JsonSerializer.Deserialize<string[]>(welcome.Actions)!.Should().HaveCount(3);
        }

        [Fact]
        public async Task Granular_Guards_Skip_Only_Tables_That_Already_Have_Rows()
        {
            await using var services = BuildServices();

            using (var scope = services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AquriDbContext>();
                db.Agents.Add(new Agent("already-here", "Existing", "Pre-seeded agent.", "paused"));
                db.SaveChanges();
            }

            using (var scope = services.CreateScope())
                await DbSeeder.SeedAsync(scope.ServiceProvider, seedDemoUsers: true);

            using (var scope = services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AquriDbContext>();
                db.Agents.Count().Should().Be(1);
                db.Users.Count().Should().Be(3);
                db.AiInsights.Count().Should().Be(5);
                db.Workflows.Count().Should().Be(4);
            }
        }
    }
}
