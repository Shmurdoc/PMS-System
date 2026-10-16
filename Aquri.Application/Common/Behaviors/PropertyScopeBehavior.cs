using System.Reflection;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Exceptions;
using MediatR;

namespace Aquri.Application.Common.Behaviors
{
    /// <summary>Confines property-assigned accounts to their property. Requests exposing a public int/int? PropertyId member are checked against <see cref="ICurrentUser.PropertyId"/>: a mismatch, or a null scope on the request, is rejected with <see cref="ForbiddenException"/> (403) before the handler runs. Unrestricted accounts and requests without a PropertyId member pass through untouched — endpoint authentication and role checks stay with [Authorize] on controllers.</summary>
    public sealed class PropertyScopeBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
        where TRequest : notnull
    {
        private static readonly PropertyInfo? ScopedProperty =
            typeof(TRequest)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .FirstOrDefault(p =>
                    p.Name == "PropertyId" &&
                    (p.PropertyType == typeof(int) || p.PropertyType == typeof(int?)));

        private readonly ICurrentUser _currentUser;

        public PropertyScopeBehavior(ICurrentUser currentUser) => _currentUser = currentUser;

        public Task<TResponse> Handle(
            TRequest request,
            RequestHandlerDelegate<TResponse> next,
            CancellationToken cancellationToken)
        {
            var scope = _currentUser.PropertyId;
            if (scope is null || ScopedProperty is null)
                return next();

            var raw = ScopedProperty.GetValue(request);
            var requestProperty = raw is int value ? value : (int?)null;
            if (requestProperty != scope)
                throw new ForbiddenException($"This account is scoped to property {scope}.");

            return next();
        }
    }
}
