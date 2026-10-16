using System.Reflection;
using FluentValidation;
using MediatR;

namespace Aquri.Application.Common.Behaviors
{
    /// <summary>Runs every registered FluentValidation validator for the request before the handler. Failures on Result-returning responses come back as Result.Failure (messages joined with "; ", matching what controllers already surface via BadRequest(result.Error)); responses that are not Result-shaped throw <see cref="ValidationException"/> so the API middleware can emit an envelope-shaped 400. Requests with no validator registered pass through untouched — validators are opt-in per command. Registered before PropertyScopeBehavior so a malformed request is rejected before property-scope reflection runs.</summary>
    public sealed class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
        where TRequest : notnull
    {
        private readonly IEnumerable<IValidator<TRequest>> _validators;

        public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
            => _validators = validators;

        public async Task<TResponse> Handle(
            TRequest request,
            RequestHandlerDelegate<TResponse> next,
            CancellationToken cancellationToken)
        {
            if (_validators.Any())
            {
                var context = new ValidationContext<TRequest>(request);

                var failures = (await Task.WhenAll(
                        _validators.Select(v => v.ValidateAsync(context, cancellationToken))))
                    .Where(r => !r.IsValid)
                    .SelectMany(r => r.Errors)
                    .ToList();

                if (failures.Count > 0)
                {
                    var message = string.Join("; ",
                        failures.Select(f => f.ErrorMessage).Distinct());

                    var failure = TryCreateFailure(message);
                    if (failure is not null)
                        return failure;

                    throw new ValidationException(failures);
                }
            }

            return await next();
        }

        /// <summary>Builds a failed Result/Result&lt;T&gt; without knowing T at compile time — Result.Failure and Result&lt;T&gt;.Failure are static factories on the closed response type. Returns null for non-Result responses (bare DTOs, lists), which the caller rejects with a thrown ValidationException instead.</summary>
        private static TResponse? TryCreateFailure(string message)
        {
            var type = typeof(TResponse);

            if (type == typeof(Result))
                return (TResponse)(object)Result.Failure(message);

            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Result<>))
            {
                var factory = type.GetMethod(
                    "Failure",
                    BindingFlags.Public | BindingFlags.Static,
                    binder: null,
                    new[] { typeof(string) },
                    modifiers: null);

                if (factory is not null)
                    return (TResponse)factory.Invoke(null, new object[] { message })!;
            }

            return default;
        }
    }
}
