using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;

namespace Aquri.API.Common
{
    /// <summary>Reads the caller's identity from the current HTTP request's JWT principal. The property scope claim survives inbound mapping because "property_id" is not part of the JWT bearer handler's inbound claim map.</summary>
    public sealed class HttpCurrentUser : ICurrentUser
    {
        private readonly IHttpContextAccessor _accessor;

        public HttpCurrentUser(IHttpContextAccessor accessor) => _accessor = accessor;

        private ClaimsPrincipal? Principal => _accessor.HttpContext?.User;

        public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

        public int? PropertyId
        {
            get
            {
                var claim = Principal?.FindFirst(AuthClaims.PropertyId);
                return claim is not null && int.TryParse(claim.Value, out var propertyId)
                    ? propertyId
                    : null;
            }
        }

        /// <summary>
        /// All property_id claims on the token. A single-property employee has
        /// one; an employee covering several hotels carries one claim per
        /// property; an unrestricted admin carries none.
        /// </summary>
        public IReadOnlyCollection<int> PropertyIds =>
            Principal?.FindAll(AuthClaims.PropertyId)
                .Select(c => int.TryParse(c.Value, out var id) ? id : 0)
                .Where(id => id > 0)
                .Distinct()
                .ToList()
            ?? (IReadOnlyCollection<int>)Array.Empty<int>();

        public int UserId
        {
            get
            {
                var claim = Principal?.FindFirst(ClaimTypes.NameIdentifier);
                return claim is not null && int.TryParse(claim.Value, out var id)
                    ? id
                    : 0;
            }
        }

        public string UserName =>
            Principal?.FindFirst(ClaimTypes.Name)?.Value ?? string.Empty;

        public string UserRole =>
            Principal?.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
    }
}
