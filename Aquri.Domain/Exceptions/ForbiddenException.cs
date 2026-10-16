using System;

namespace Aquri.Domain.Exceptions
{
    /// <summary>
    /// Thrown when a request is well-formed but falls outside the caller's
    /// assigned scope — today: a property-assigned account attempting an
    /// operation on another property (or none at all). Distinct from
    /// <see cref="DomainException"/> (business-rule violation → 400) and from
    /// authentication failures (401): the caller is known, just not allowed
    /// here. Mapped to HTTP 403 by ApiResponseMiddleware.
    /// </summary>
    public class ForbiddenException : Exception
    {
        public ForbiddenException(string message) : base(message) { }
    }
}
