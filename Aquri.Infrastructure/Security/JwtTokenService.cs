using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Aquri.Infrastructure.Security
{
    /// <summary>Issues signed JWTs using the symmetric key from configuration ("Jwt" section). Claims carry the user id, email, display name, and role — the same role strings matched by [Authorize(Roles = "...")] on API controllers — plus a property_id scope claim when the account is assigned to a property (absent for unrestricted accounts: the security default).</summary>
    public class JwtTokenService : ITokenService
    {
        private readonly string _key;
        private readonly string _issuer;
        private readonly string _audience;
        private readonly int _expiresInMinutes;

        public JwtTokenService(IConfiguration configuration)
        {
            _key = configuration["Jwt:Key"] ?? string.Empty;
            if (string.IsNullOrWhiteSpace(_key) || _key.Length < 32)
                throw new InvalidOperationException("Missing configuration: Jwt:Key (minimum 32 characters).");
            _issuer = configuration["Jwt:Issuer"] ?? "Aquri.API";
            _audience = configuration["Jwt:Audience"] ?? "Aquri.Client";
            _expiresInMinutes = int.TryParse(configuration["Jwt:ExpiresInMinutes"], out var minutes) && minutes > 0 ? minutes : 60;
        }

        public string CreateToken(User user)
        {
            ArgumentNullException.ThrowIfNull(user);

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Name, user.Name),
                new(ClaimTypes.Role, user.Role),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            if (user.PropertyId.HasValue)
                claims.Add(new Claim(AuthClaims.PropertyId, user.PropertyId.Value.ToString()));

            // One claim per property the account may work in. The primary
            // PropertyId above already covers the first; add the rest so an
            // employee covering several hotels carries the full scope.
            foreach (var assignment in user.PropertyAssignments)
            {
                if (assignment.PropertyId == user.PropertyId)
                    continue;
                claims.Add(new Claim(AuthClaims.PropertyId, assignment.PropertyId.ToString()));
            }

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_key));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _issuer,
                audience: _audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_expiresInMinutes),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
