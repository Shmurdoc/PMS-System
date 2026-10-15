using System;

namespace Aquri.Domain.Exceptions
{
    /// <summary>
    /// Thrown when a domain invariant or business rule is violated
    /// (illegal status transition, overpayment, invalid state change).
    /// Distinct from ArgumentException (caller bug) and InvalidOperationException
    /// (infrastructure failure): the request is well-formed but the operation
    /// is not allowed given the entity's current state. Mapped to HTTP 400 by
    /// ApiResponseMiddleware.
    /// </summary>
    public class DomainException : Exception
    {
        public DomainException(string message) : base(message) { }

        public DomainException(string message, Exception innerException)
            : base(message, innerException) { }
    }
}
