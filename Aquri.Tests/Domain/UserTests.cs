using System;
using Aquri.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Users
{
    /// <summary>Covers User entity invariants: constructor validation, role whitelist, email matching, and domain-method guards.</summary>
    public class UserTests
    {
        [Fact]
        public void Constructor_Sets_Fields_And_Defaults()
        {
            var user = new User("admin@nexus.com", "Admin User", AppRoles.Admin, "hash");

            user.Email.Should().Be("admin@nexus.com");
            user.Name.Should().Be("Admin User");
            user.Role.Should().Be(AppRoles.Admin);
            user.PasswordHash.Should().Be("hash");
            user.Created.Should().NotBe(default);
        }

        [Fact]
        public void Constructor_Trims_Email_And_Name()
        {
            var user = new User("  admin@nexus.com  ", "  Admin User  ", AppRoles.Admin, "hash");

            user.Email.Should().Be("admin@nexus.com");
            user.Name.Should().Be("Admin User");
        }

        [Theory]
        [InlineData("", "Name", "admin", "hash")]
        [InlineData("email", "", "admin", "hash")]
        [InlineData("email", "Name", "", "hash")]
        [InlineData("email", "Name", "admin", "")]
        public void Constructor_Rejects_Empty_Required_Fields(string email, string name, string role, string hash)
        {
            Action act = () => new User(email, name, role, hash);

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void Constructor_Rejects_Unknown_Role()
        {
            Action act = () => new User("a@b.c", "Name", "superuser", "hash");

            act.Should().Throw<ArgumentException>()
                .WithMessage("*Role must be one of*");
        }

        [Theory]
        [InlineData(AppRoles.Admin)]
        [InlineData(AppRoles.Manager)]
        [InlineData(AppRoles.FrontDesk)]
        [InlineData(AppRoles.Housekeeping)]
        [InlineData(AppRoles.Maintenance)]
        [InlineData(AppRoles.Auditor)]
        public void Constructor_Accepts_All_Valid_Roles(string role)
        {
            Action act = () => new User("a@b.c", "Name", role, "hash");

            act.Should().NotThrow();
        }

        [Fact]
        public void ChangeRole_Accepts_Valid_Role()
        {
            var user = new User("a@b.c", "Name", AppRoles.Admin, "hash");

            user.ChangeRole(AppRoles.Manager);

            user.Role.Should().Be(AppRoles.Manager);
        }

        [Fact]
        public void ChangeRole_Rejects_Unknown_Role()
        {
            var user = new User("a@b.c", "Name", AppRoles.Admin, "hash");

            Action act = () => user.ChangeRole("hacker");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void SetPasswordHash_Updates_Hash()
        {
            var user = new User("a@b.c", "Name", AppRoles.Admin, "old-hash");

            user.SetPasswordHash("new-hash");

            user.PasswordHash.Should().Be("new-hash");
        }

        [Fact]
        public void SetPasswordHash_Rejects_Empty()
        {
            var user = new User("a@b.c", "Name", AppRoles.Admin, "hash");

            Action act = () => user.SetPasswordHash("");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void UpdateProfile_Sets_Fields()
        {
            var user = new User("a@b.c", "Name", AppRoles.Admin, "hash");

            user.UpdateProfile("New Name", "Management", "555-1234");

            user.Name.Should().Be("New Name");
            user.Department.Should().Be("Management");
            user.Phone.Should().Be("555-1234");
        }

        [Fact]
        public void EmailMatches_Ignores_Case_And_Whitespace()
        {
            var user = new User("admin@nexus.com", "Name", AppRoles.Admin, "hash");

            user.EmailMatches("  ADMIN@NEXUS.COM  ").Should().BeTrue();
            user.EmailMatches("other@nexus.com").Should().BeFalse();
            user.EmailMatches("").Should().BeFalse();
            user.EmailMatches(null!).Should().BeFalse();
        }
    }
}
