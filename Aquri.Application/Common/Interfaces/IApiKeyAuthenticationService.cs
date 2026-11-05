using System.Security.Claims;
using System.Threading.Tasks;

namespace Aquri.Application.Common.Interfaces;

/// <summary>Authenticates programmatic API key access. Validates the key against the store, records usage, and returns the key owner's claims principal.</summary>
public interface IApiKeyAuthenticationService
{
    /// <summary>Authenticates an "Authorization: Apikey <key>" request. Returns the key owner's <see cref="ClaimsPrincipal"/> on success, or null when the key is invalid, inactive, or expired.</summary>
    Task<ClaimsPrincipal?> AuthenticateAsync(string rawKey);
}
