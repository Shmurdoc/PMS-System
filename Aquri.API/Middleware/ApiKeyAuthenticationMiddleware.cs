using System;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Aquri.API.Middleware
{
    /// <summary>Authenticates requests that carry an "Authorization: Apikey <key>" header.
    /// Validates the key against the ApiKeys table, checks expiry and active status,
    /// and sets HttpContext.User to the key owner's claims so the rest of the pipeline
    /// (ICurrentUser, property scopes, authorization) works as with JWT auth.</summary>
    public class ApiKeyAuthenticationMiddleware
    {
        private const string Scheme = "Apikey";
        private readonly RequestDelegate _next;

        public ApiKeyAuthenticationMiddleware(RequestDelegate next) => _next = next;

        public async Task InvokeAsync(HttpContext context, IServiceProvider services)
        {
            var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
            if (authHeader != null && authHeader.StartsWith(Scheme + " ", StringComparison.OrdinalIgnoreCase))
            {
                var rawKey = authHeader[(Scheme.Length + 1)..].Trim();
                if (!string.IsNullOrEmpty(rawKey))
                {
                    await AuthenticateWithApiKey(context, services, rawKey);
                }
            }

            await _next(context);
        }

        private static async Task AuthenticateWithApiKey(
            HttpContext context,
            IServiceProvider services,
            string rawKey)
        {
            using var scope = services.CreateScope();
            var contextDb = scope.ServiceProvider.GetRequiredService<Aquri.Infrastructure.Persistence.AquriDbContext>();

            // Hash the provided key the same way it was hashed at creation.
            // IPasswordHasher is scoped, so resolve it from the same scope.
            var hasher = scope.ServiceProvider.GetRequiredService<Aquri.Application.Common.Interfaces.IPasswordHasher>();
            var keyHash = hasher.Hash(rawKey);

            var apiKey = await contextDb.ApiKeys
                .FirstOrDefaultAsync(k => k.KeyHash == keyHash && k.IsActive, context.RequestAborted);

            if (apiKey is null || apiKey.IsExpired())
            {
                // Key not found, inactive, or expired — return 401.
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "Invalid or expired API key."
                });
                return;
            }

            // Record usage.
            apiKey.RecordUsage();
            await contextDb.SaveChangesAsync(context.RequestAborted);

            // Build a ClaimsPrincipal for the key owner, mirroring JWT claims.
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, apiKey.UserId.ToString()),
                new Claim(ClaimTypes.Role, "api_key"),
                new Claim("api_key_id", apiKey.Id.ToString()),
                new Claim("api_key_name", apiKey.Name)
            };

            if (apiKey.PropertyId.HasValue)
                claims = claims.Append(new Claim("property_id", apiKey.PropertyId.Value.ToString())).ToArray();

            var identity = new ClaimsIdentity(claims, Scheme);
            context.User = new ClaimsPrincipal(identity);
        }
    }
}
