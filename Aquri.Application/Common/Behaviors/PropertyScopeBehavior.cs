using System.Reflection;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Exceptions;
using MediatR;

namespace Aquri.Application.Common.Behaviors
{
    /// <summary>
    /// Confines scoped accounts to their property. A request that carries a
    /// PropertyId has to match the caller's own, or the call fails with
    /// <see cref="ForbiddenException"/> before the handler runs. Leaving it out
    /// is fine: the handler fills it in from the current user, and the EF
    /// filters keep reads inside the property. Admins and requests without a
    /// PropertyId member pass through.
    /// </summary>
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
            // Admins (and anonymous callers) are unrestricted: no property scope.
            var scope = _currentUser.PropertyIds;
            if (scope.Count == 0 || ScopedProperty is null)
                return next();

            var raw = ScopedProperty.GetValue(request);
            var requestProperty = raw is int value ? value : (int?)null;
            if (requestProperty.HasValue && !scope.Contains(requestProperty.Value))
            {
                var allowed = scope.Count == 1
                    ? $"property {scope.First()}"
                    : $"properties {string.Join(", ", scope)}";
                throw new ForbiddenException($"This account is scoped to {allowed}.");
            }

            return next();
        }
    }
}
