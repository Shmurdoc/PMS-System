using System.Security.Claims;
using System.Threading.Tasks;
using Aquri.Application.Common.Exceptions;
using Aquri.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

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

    public async Task<ClaimsPrincipal?> AuthenticateAsync(string rawKey)
    {
        if (string.IsNullOrWhiteSpace(rawKey))
            return null;

        var keyHash = _hasher.Hash(rawKey.Trim());

        var apiKey = await _context.ApiKeys
            .FirstOrDefaultAsync(k => k.KeyHash == keyHash && k.IsActive);

        if (apiKey is null || apiKey.IsExpired())
            return null;

        // Record usage and persist immediately so usage is never lost,
        // even if a later pipeline stage short-circuits the request.
        apiKey.RecordUsage();
        await _context.SaveChangesAsync();

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
