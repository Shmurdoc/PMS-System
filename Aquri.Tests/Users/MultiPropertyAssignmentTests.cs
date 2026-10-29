using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.Users;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests.Users
{
    /// <summary>
    /// The multi-property requirement: an owner has many hotels, and one
    /// employee can cover several of them. The employee must see exactly the
    /// properties they are assigned to, never the rest.
    /// </summary>
    public class MultiPropertyAssignmentTests
    {
        private static AquriDbContext NewContext(ICurrentUser? user = null, string? databaseName = null)
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory, Aquri.Infrastructure.Persistence.PropertyScopeModelCacheKeyFactory>()
                .UseInMemoryDatabase(databaseName: databaseName ?? System.Guid.NewGuid().ToString())
                .Options;
            return new AquriDbContext(options, user);
        }

        private static async Task SeedElevenPropertiesAsync(AquriDbContext ctx)
        {
            for (var i = 1; i <= 11; i++)
                ctx.Properties.Add(new Property($"QA Hotel {i}", i));
            await ctx.SaveChangesAsync();
        }

        [Fact]
        public void User_Can_Be_Assigned_To_Three_Properties()
        {
            var user = new User("front@nexus.com", "Front Desk", AppRoles.FrontDesk, "hash");

            user.ReplacePropertyAssignments(new[] { 4, 7, 9 });

            user.PropertyAssignments.Select(a => a.PropertyId).Should().BeEquivalentTo(new[] { 4, 7, 9 });
            user.PropertyId.Should().Be(4, "the first id becomes the primary property");
        }

        [Fact]
        public void NonAdmin_Cannot_Be_Left_With_No_Property()
        {
            var user = new User("front@nexus.com", "Front Desk", AppRoles.FrontDesk, "hash");

            var act = () => user.ReplacePropertyAssignments(System.Array.Empty<int>());

            act.Should().Throw<System.ArgumentException>();
        }

        [Fact]
        public void Admin_May_Have_No_Property()
        {
            var user = new User("admin@nexus.com", "Admin", AppRoles.Admin, "hash");

            user.ReplacePropertyAssignments(System.Array.Empty<int>());

            user.PropertyAssignments.Should().BeEmpty();
            user.PropertyId.Should().BeNull();
        }

        [Fact]
        public async Task Employee_Sees_Only_Assigned_Properties_Of_Eleven()
        {
            var db = System.Guid.NewGuid().ToString();
            using var adminCtx = NewContext(databaseName: db);
            await SeedElevenPropertiesAsync(adminCtx);

            var employee = new User("front@nexus.com", "Front Desk", AppRoles.FrontDesk, "hash");
            employee.ReplacePropertyAssignments(new[] { 4, 7, 9 });
            adminCtx.Users.Add(employee);
            await adminCtx.SaveChangesAsync();

            // Same employee, now acting in the API: scoped to 4, 7 and 9.
            using var scopedCtx = NewContext(new ScopedUser(4, 7, 9), db);

            // Guard against a silent scope-computation bug before asserting rows.
            scopedCtx.PropertyScopeIds.Should().BeEquivalentTo(new[] { 4, 7, 9 });

            var visible = await scopedCtx.Properties.AsNoTracking()
                .Select(p => p.PropertyId).OrderBy(id => id).ToListAsync();

            visible.Should().BeEquivalentTo(new[] { 4, 7, 9 });
            visible.Should().NotContain(1);
            visible.Should().HaveCount(3, "eleven properties exist in the owner's portfolio");
        }

        [Fact]
        public async Task Employee_Data_Reads_Are_Confined_To_Assigned_Properties()
        {
            var db = System.Guid.NewGuid().ToString();
            using var adminCtx = NewContext(databaseName: db);
            await SeedElevenPropertiesAsync(adminCtx);

            // Rooms in an assigned hotel and in a hotel outside the scope.
            adminCtx.Rooms.Add(new Room("A1", 7, "double"));
            adminCtx.Rooms.Add(new Room("B1", 2, "double"));
            await adminCtx.SaveChangesAsync();

            using var scopedCtx = NewContext(new ScopedUser(4, 7, 9), db);
            var rooms = await scopedCtx.Rooms.AsNoTracking().ToListAsync();

            rooms.Should().ContainSingle().Which.PropertyId.Should().Be(7);
        }

        [Fact]
        public async Task Misconfigured_NonAdmin_With_No_Scope_Sees_Nothing()
        {
            var db = System.Guid.NewGuid().ToString();
            using var adminCtx = NewContext(databaseName: db);
            await SeedElevenPropertiesAsync(adminCtx);

            // Authenticated non-admin, but no assignments: must be denied, not
            // silently promoted to "sees everything".
            using var scopedCtx = NewContext(new ScopedUser(), db);

            (await scopedCtx.Properties.CountAsync()).Should().Be(0);
        }

        [Fact]
        public async Task Admin_Creating_Staff_With_Several_Properties_Persists_All_Assignments()
        {
            using var ctx = NewContext();
            await SeedElevenPropertiesAsync(ctx);

            var handler = new CreateUserHandler(ctx, new PassthroughHasher(), new AdminUser());
            var result = await handler.Handle(
                new CreateUserCommand(
                    "front@nexus.com", "Front Desk", "password123", AppRoles.FrontDesk,
                    "Front Desk", null, PropertyIds: new[] { 4, 7, 9 }),
                CancellationToken.None);

            result.Success.Should().BeTrue(result.Error);
            result.Data!.PropertyIds.Should().BeEquivalentTo(new[] { 4, 7, 9 });
            result.Data.PropertyId.Should().Be(4);

            var stored = await ctx.UserPropertyAssignments
                .Where(a => a.UserId == result.Data.Id)
                .Select(a => a.PropertyId)
                .ToListAsync();
            stored.Should().BeEquivalentTo(new[] { 4, 7, 9 });
        }

        [Fact]
        public async Task Admin_Update_Replaces_The_Property_Set()
        {
            using var ctx = NewContext();
            await SeedElevenPropertiesAsync(ctx);

            var employee = new User("front@nexus.com", "Front Desk", AppRoles.FrontDesk, "hash");
            employee.ReplacePropertyAssignments(new[] { 4, 7, 9 });
            ctx.Users.Add(employee);
            await ctx.SaveChangesAsync();

            var handler = new UpdateUserHandler(ctx, new PassthroughHasher(), new AdminUser());
            var result = await handler.Handle(
                new UpdateUserCommand(employee.Id, "Front Desk", "Front Desk", null, null, null,
                    PropertyIds: new[] { 7, 9 }),
                CancellationToken.None);

            result.Success.Should().BeTrue(result.Error);
            result.Data!.PropertyIds.Should().BeEquivalentTo(new[] { 7, 9 });

            var stored = await ctx.UserPropertyAssignments
                .Where(a => a.UserId == employee.Id)
                .Select(a => a.PropertyId)
                .ToListAsync();
            stored.Should().BeEquivalentTo(new[] { 7, 9 }, "property 4 was removed from the set");
        }

        private sealed class AdminUser : ICurrentUser
        {
            public bool IsAuthenticated => true;
            public int? PropertyId => null;
            public IReadOnlyCollection<int> PropertyIds => System.Array.Empty<int>();
            public int UserId => 1;
            public string UserName => "Admin";
            public string UserRole => AppRoles.Admin;
        }

        private sealed class ScopedUser : ICurrentUser
        {
            public ScopedUser(params int[] ids)
            {
                PropertyIds = ids;
                PropertyId = ids.Length > 0 ? ids[0] : null;
            }

            public bool IsAuthenticated => true;
            public int? PropertyId { get; }
            public IReadOnlyCollection<int> PropertyIds { get; }
            public int UserId => 2;
            public string UserName => "Front Desk";
            public string UserRole => AppRoles.FrontDesk;
        }

        private sealed class PassthroughHasher : IPasswordHasher
        {
            public string Hash(string password) => $"hash:{password}";
            public bool Verify(string password, string hash) => hash == $"hash:{password}";
        }
    }
}
