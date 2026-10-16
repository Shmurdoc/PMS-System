using System;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Auth;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using Aquri.Infrastructure.Security;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests.Auth
{
    /// <summary>In-memory harness for auth handlers: real AquriDbContext + real PBKDF2 hasher. ITokenService is faked so tests do not depend on JWT config.</summary>
    public class AuthHandlerTestBase : IDisposable
    {
        protected readonly AquriDbContext Context;
        protected readonly Pbkdf2PasswordHasher Hasher;

        public AuthHandlerTestBase()
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            Context = new AquriDbContext(options);
            Hasher = new Pbkdf2PasswordHasher();
        }

        protected async Task<User> SeedUserAsync(string email = "admin@nexus.com", string password = "admin123", string role = AppRoles.Admin)
        {
            var user = new User(email, "Admin User", role, Hasher.Hash(password));
            Context.Users.Add(user);
            await Context.SaveChangesAsync();
            return user;
        }

        public void Dispose()
        {
            Context.Dispose();
        }
    }

    /// <summary>No-op token service so LoginHandler tests focus on auth logic, not JWT wiring.</summary>
    public class FakeTokenService : ITokenService
    {
        public string CreateToken(User user) => $"token-for-{user.Id}";
    }

    public class LoginHandler_Should : AuthHandlerTestBase
    {
        [Fact]
        public async Task Return_Token_And_User_For_Valid_Credentials()
        {
            var seeded = await SeedUserAsync();
            var handler = new LoginHandler(Context, Hasher, new FakeTokenService());

            var result = await handler.Handle(new LoginCommand("admin@nexus.com", "admin123"), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data!.Token.Should().Be($"token-for-{seeded.Id}");
            result.Data.User.Email.Should().Be("admin@nexus.com");
            result.Data.User.Role.Should().Be(AppRoles.Admin);
        }

        [Fact]
        public async Task Match_Email_Case_Insensitively()
        {
            await SeedUserAsync(email: "Admin@Nexus.com");
            var handler = new LoginHandler(Context, Hasher, new FakeTokenService());

            var result = await handler.Handle(new LoginCommand("admin@nexus.COM", "admin123"), CancellationToken.None);

            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task Fail_For_Wrong_Password_Without_Revealing_Which_Credential()
        {
            await SeedUserAsync();
            var handler = new LoginHandler(Context, Hasher, new FakeTokenService());

            var result = await handler.Handle(new LoginCommand("admin@nexus.com", "wrong"), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Be("Invalid email or password.");
        }

        [Fact]
        public async Task Fail_For_Unknown_Email()
        {
            var handler = new LoginHandler(Context, Hasher, new FakeTokenService());

            var result = await handler.Handle(new LoginCommand("nobody@nexus.com", "admin123"), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Be("Invalid email or password.");
        }

        [Theory]
        [InlineData("", "admin123")]
        [InlineData("admin@nexus.com", "")]
        [InlineData(null, "admin123")]
        [InlineData("admin@nexus.com", null)]
        public async Task Fail_For_Missing_Email_Or_Password(string email, string password)
        {
            await SeedUserAsync();
            var handler = new LoginHandler(Context, Hasher, new FakeTokenService());

            var result = await handler.Handle(new LoginCommand(email, password), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Be("Email and password are required.");
        }
    }

    public class GetCurrentUserHandler_Should : AuthHandlerTestBase
    {
        [Fact]
        public async Task Return_UserDto_When_Found()
        {
            var seeded = await SeedUserAsync();
            var handler = new GetCurrentUserHandler(Context);

            var result = await handler.Handle(new GetCurrentUserQuery(seeded.Id), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data!.Id.Should().Be(seeded.Id);
            result.Data.Email.Should().Be("admin@nexus.com");
        }

        [Fact]
        public async Task Return_NotFound_When_User_Missing()
        {
            var handler = new GetCurrentUserHandler(Context);

            var result = await handler.Handle(new GetCurrentUserQuery(999), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.NotFound.Should().BeTrue();
        }
    }
}
