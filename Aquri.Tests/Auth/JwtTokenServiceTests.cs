using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Security;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Aquri.Tests.Auth
{
    /// <summary>The JWT carries the caller's property scope so downstream requests can be confined to that property: assigned users get a property_id claim, unrestricted users do not.</summary>
    public class JwtTokenServiceTests
    {
        private const string PropertyClaim = "property_id";

        private static JwtTokenService CreateService()
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:Key"] = "TestOnlyKeyAtLeast32CharactersLong!!!!",
                    ["Jwt:Issuer"] = "Aquri.API",
                    ["Jwt:Audience"] = "Aquri.Client"
                })
                .Build();

            return new JwtTokenService(configuration);
        }

        [Fact]
        public void Token_Carries_Property_Scope_When_User_Is_Assigned()
        {
            var user = new User("scoped@nexus.com", "Scoped User", AppRoles.FrontDesk, "test-hash");
            user.AssignProperty(7);

            var token = new JwtSecurityTokenHandler().ReadJwtToken(
                CreateService().CreateToken(user));

            token.Claims.Should().Contain(c => c.Type == PropertyClaim && c.Value == "7");
        }

        [Fact]
        public void Token_Omits_Property_Scope_For_Unrestricted_User()
        {
            var user = new User("admin@nexus.com", "Admin User", AppRoles.Admin, "test-hash");

            var token = new JwtSecurityTokenHandler().ReadJwtToken(
                CreateService().CreateToken(user));

            token.Claims.Should().NotContain(c => c.Type == PropertyClaim);
        }
    }
}
