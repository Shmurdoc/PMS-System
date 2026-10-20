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
