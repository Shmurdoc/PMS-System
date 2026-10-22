using System.Text.Json;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Aquri.Infrastructure.Persistence
{
    /// <summary>Idempotent database seeding — safe to call on every startup. Each table guards itself, so a half-seeded database finishes converging on the next boot instead of being skipped wholesale. Demo logins and the sample AI layer (the mock insights, workflows, and six agent definitions from AIEnhancements.tsx) are created only when the caller asks (Seed:DemoUsers).</summary>
    public static class DbSeeder
    {
        public static async Task SeedAsync(IServiceProvider services, bool seedDemoUsers)
        {
            var db = services.GetRequiredService<AquriDbContext>();
            var hasher = services.GetRequiredService<IPasswordHasher>();
            var logger = services.GetRequiredService<ILoggerFactory>()
                .CreateLogger("DbSeeder");

            if (!seedDemoUsers) return;

            // The property goes first: staff accounts and the sample data below need a
            // property to belong to, and messages and bookings carry its foreign key.
            if (!await db.Properties.AnyAsync())
            {
                db.Properties.Add(new Property("Nexus Grand Hotel", 1));
                await db.SaveChangesAsync();

                logger.LogInformation("Seeded 1 demo property.");
            }

            if (!await db.Users.AnyAsync())
            {
                var manager = new User("manager@nexus.com", "Manager User", AppRoles.Manager, hasher.Hash("manager123"));
                manager.AssignProperty(1);

                var front = new User("front@nexus.com", "Front Desk", AppRoles.FrontDesk, hasher.Hash("front123"));
                front.AssignProperty(1);

                var users = new[]
                {
                    new User("admin@nexus.com", "Admin User", AppRoles.Admin, hasher.Hash("admin123")),
                    manager,
                    front
                };

                db.Users.AddRange(users);
                await db.SaveChangesAsync();

                logger.LogInformation("Seeded {Count} demo users.", users.Length);
            }

            // Databases seeded before accounts had a property leave the demo staff
            // unscoped. Move them onto the demo property; the admin stays unscoped.
            var unscopedDemoStaff = await db.Users
                .Where(u => (u.Email == "manager@nexus.com" || u.Email == "front@nexus.com") && u.PropertyId == null)
                .ToListAsync();

            if (unscopedDemoStaff.Count > 0)
            {
                foreach (var user in unscopedDemoStaff)
                    user.AssignProperty(1);

                await db.SaveChangesAsync();
                logger.LogInformation("Assigned {Count} demo staff to property 1.", unscopedDemoStaff.Count);
            }

            if (!await db.Agents.AnyAsync())
            {
                db.Agents.AddRange(
                    new Agent("revenue-optimizer", "Revenue Optimizer",
                        "Dynamic pricing optimization and revenue forecasting based on market demand"),
                    new Agent("guest-predictor", "Guest Predictor",
                        "Predicts guest preferences, satisfaction scores, and repeat visit likelihood"),
                    new Agent("maintenance-scheduler", "Maintenance Scheduler",
                        "Predictive maintenance scheduling and resource optimization", "paused"),
                    new Agent("rate-analyzer", "Rate Analyzer",
                        "Competitive rate analysis and market positioning recommendations"),
                    new Agent("staffing-optimizer", "Staffing Optimizer",
                        "AI-driven staff scheduling based on occupancy predictions and workload", "stopped"),
                    new Agent("inventory-monitor", "Inventory Monitor",
                        "Tracks supply levels and automates reorder recommendations"));
                await db.SaveChangesAsync();

                logger.LogInformation("Seeded 6 AI agents.");
            }

            if (!await db.AiInsights.AnyAsync())
            {
                db.AiInsights.AddRange(
                    new AiInsight(null, "revenue", "Revenue Optimization",
                        "Based on current booking trends and seasonal patterns",
                        "Consider increasing weekend rates by 15% for April", "high"),
                    new AiInsight(null, "occupancy", "Occupancy Forecast",
                        "Predictive analysis of room demand",
                        "Expected 92% occupancy next week - optimize staff scheduling", "high"),
                    new AiInsight(null, "staffing", "Staffing Recommendation",
                        "Workload analysis based on occupancy",
                        "Add 2 housekeeping staff for afternoon shift on Friday", "medium"),
                    new AiInsight(null, "maintenance", "Predictive Maintenance",
                        "Equipment health monitoring",
                        "Schedule HVAC inspection within next 2 weeks", "medium"),
                    new AiInsight(null, "guest", "Guest Experience",
                        "Satisfaction prediction based on reviews",
                        "Focus on breakfast service quality - recent feedback mentions delays", "high"));
                await db.SaveChangesAsync();

                logger.LogInformation("Seeded {Count} sample AI insights.", 5);
            }

            if (!await db.Workflows.AnyAsync())
            {
                db.Workflows.AddRange(
                    new Workflow(null, "Guest Check-in Welcome",
                        "Automated welcome sequence for arriving guests", "On check-in",
                        ActionList("Send welcome email", "Notify housekeeping", "Update preferences"),
                        "active", null),
                    new Workflow(null, "Low Inventory Alert",
                        "Alert when inventory drops below threshold", "Stock below reorder level",
                        ActionList("Notify manager", "Create purchase order", "Log alert"),
                        "active", null),
                    new Workflow(null, "Late Checkout Auto-Extension",
                        "Handle late checkout scenarios automatically", "Check-out time exceeded",
                        ActionList("Send notification", "Apply late fee", "Update room status"),
                        "inactive", null),
                    new Workflow(null, "Maintenance Escalation",
                        "Escalate unresolved maintenance tickets", "Ticket unresolved for 48hrs",
                        ActionList("Escalate to manager", "Notify department head", "Log incident"),
                        "active", null));
                await db.SaveChangesAsync();

                logger.LogInformation("Seeded {Count} sample workflows.", 4);
            }
        }

        /// <summary>Workflow actions live as a JSON array — same shape the API returns.</summary>
        private static string ActionList(params string[] steps) =>
            JsonSerializer.Serialize(steps);
    }
}
