using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Aquri.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace Aquri.API.Middleware;

/// <summary>Authenticates requests that carry an "Authorization: Apikey <key>" header.
/// Delegates key validation, usage recording, and claims construction to
/// <see cref="IApiKeyAuthenticationService"/>, then sets <see cref="HttpContext.User"/>
/// so the rest of the pipeline (<see cref="ICurrentUser"/>, property scopes, authorization)
/// works as with JWT auth.</summary>
public class ApiKeyAuthenticationMiddleware
{
    private const string Scheme = "Apikey";
    private readonly RequestDelegate _next;

    public ApiKeyAuthenticationMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        if (authHeader != null && authHeader.StartsWith(Scheme + " ", StringComparison.OrdinalIgnoreCase))
        {
            var rawKey = authHeader[(Scheme.Length + 1)..].Trim();
            if (!string.IsNullOrEmpty(rawKey))
            {
                // Resolve scoped from the request's service provider — middleware
                // constructors are resolved from the root provider, so scoped
                // services must be looked up per-request.
                var authService = context.RequestServices.GetRequiredService<IApiKeyAuthenticationService>();
                var principal = authService.Authenticate(rawKey);
                if (principal is not null)
                    context.User = principal;
                else
                {
                    // Key not found, inactive, or expired — return 401.
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsJsonAsync(new { error = "Invalid or expired API key." });
                    return;
                }
            }
        }

        await _next(context);
    }
}
