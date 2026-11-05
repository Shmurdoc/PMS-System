using System.Security.Claims;
using Aquri.Application.Common.Exceptions;
using Aquri.Application.Common.Interfaces;

namespace Aquri.Application.ApiKeys;

/// <summary>Authenticates API keys against the <see cref="IApplicationDbContext"/> store. Records usage on success.</summary>
public sealed class ApiKeyAuthenticationService : IApiKeyAuthenticationService
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _hasher;

    public ApiKeyAuthenticationService(
        IApplicationDbContext context,
        IPasswordHasher hasher)
    {
        _context = context;
        _hasher = hasher;
    }

    public ClaimsPrincipal? Authenticate(string rawKey)
    {
        if (string.IsNullOrWhiteSpace(rawKey))
            return null;

        var keyHash = _hasher.Hash(rawKey.Trim());

        var apiKey = _context.ApiKeys
            .FirstOrDefault(k => k.KeyHash == keyHash && k.IsActive);

        if (apiKey is null || apiKey.IsExpired())
            return null;

        // Record usage — commits with the caller's SaveChanges scope.
        apiKey.RecordUsage();

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, apiKey.UserId.ToString()),
            new(ClaimTypes.Role, "api_key"),
            new("api_key_id", apiKey.Id.ToString()),
            new("api_key_name", apiKey.Name)
        };

        if (apiKey.PropertyId.HasValue)
            claims.Add(new Claim("property_id", apiKey.PropertyId.Value.ToString()));

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "Apikey"));
    }
}
