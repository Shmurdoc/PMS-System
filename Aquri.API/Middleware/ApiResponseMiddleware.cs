using System.Text.Json;
using Aquri.API.Common;
using Aquri.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace Aquri.API.Middleware
{
    /// <summary>
        /// Wraps every JSON API response in the <see cref="ApiResponse{T}"/> envelope
        /// and manages the X-Request-ID correlation header. Paths under /health and
        /// /swagger pass through untouched (load balancers and Swagger UI read raw
        /// payloads). 3xx redirects and body-forbidden statuses (204/304) also pass
        /// through so clients keep working.
    ///
    /// Controllers keep returning bare DTOs / strings via Result — the envelope
    /// is applied here once, so every current and future endpoint conforms.
    /// ForbiddenException (a property-assigned account operating outside its
    /// scope) is emitted as an envelope-shaped 403 FORBIDDEN. DbUpdateException
    /// below (unique-constraint races: duplicate e-mails, colliding business
    /// numbers) is emitted as an envelope-shaped 409 CONFLICT; any other
    /// unhandled exception is emitted as an envelope-shaped 500
    /// (UseExceptionHandler remains as a backstop for failures above it).
    /// </summary>
    public class ApiResponseMiddleware
    {
        public const string RequestIdItemKey = "RequestId";
        public const string RequestIdHeader = "X-Request-ID";

        private static readonly string[] ExcludedPathPrefixes = { "/health", "/swagger" };

        private readonly RequestDelegate _next;
        private readonly TimeProvider _timeProvider;

        public ApiResponseMiddleware(RequestDelegate next, TimeProvider timeProvider)
        {
            _next = next;
            _timeProvider = timeProvider;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var path = context.Request.Path.Value ?? string.Empty;
            if (ExcludedPathPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
            {
                await _next(context);
                return;
            }

            // Correlation id: echo the caller's X-Request-ID, otherwise mint one.
            var requestId = context.Request.Headers[RequestIdHeader].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(requestId))
                requestId = Guid.NewGuid().ToString("N");
            context.Items[RequestIdItemKey] = requestId;
            context.Response.Headers[RequestIdHeader] = requestId;

            var originalBody = context.Response.Body;
            using var buffer = new MemoryStream();
            context.Response.Body = buffer;

            try
            {
                await _next(context);

                if (context.Response.HasStarted)
                    return; // response already reached the client — leave as-is

                var statusCode = context.Response.StatusCode;
                var bodyBytes = buffer.ToArray();

                // Redirects (e.g. HTTPS redirection) and body-forbidden statuses
                // (204 No Content, 304 Not Modified) pass through unwrapped —
                // RFC 9110 forbids a message body on them.
                if (statusCode is >= 300 and < 400
                    || statusCode is StatusCodes.Status204NoContent or StatusCodes.Status304NotModified)
                {
                    context.Response.Body = originalBody;
                    await originalBody.WriteAsync(bodyBytes);
                    return;
                }

                context.Response.Body = originalBody;
                context.Response.Headers.ContentLength = null;
                context.Response.ContentType = "application/json; charset=utf-8";

                var envelope = BuildEnvelope(statusCode, bodyBytes, requestId);
                await context.Response.WriteAsJsonAsync(envelope);
            }
            catch (ForbiddenException ex)
            {
                // If the response already started streaming, we cannot rewrite it —
                // rethrow and let the host log the failure.
                if (context.Response.HasStarted) throw;

                // Caller is known but outside its property scope — 403 FORBIDDEN
                // (not 401: authenticated; not 400: the request shape is fine).
                context.Response.Body = originalBody;
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json; charset=utf-8";
                context.Response.Headers.ContentLength = null;

                var envelope = new ApiResponse<object>
                {
                    Success = false,
                    Error = new ApiError
                    {
                        Code = ErrorCodes.Forbidden,
                        Message = ex.Message
                    },
                    Timestamp = _timeProvider.GetUtcNow().UtcDateTime,
                    RequestId = requestId
                };
                await context.Response.WriteAsJsonAsync(envelope);
            }
            catch (DomainException ex)
            {
                // If the response already started streaming, we cannot rewrite it —
                // rethrow and let the host log the failure.
                if (context.Response.HasStarted) throw;

                // Business-rule violation (illegal transition, overpayment, …).
                // The request was well-formed but the operation is not allowed —
                // 400 VALIDATION, not a generic 500.
                context.Response.Body = originalBody;
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                context.Response.ContentType = "application/json; charset=utf-8";
                context.Response.Headers.ContentLength = null;

                var envelope = new ApiResponse<object>
                {
                    Success = false,
                    Error = new ApiError
                    {
                        Code = ErrorCodes.Validation,
                        Message = ex.Message
                    },
                    Timestamp = _timeProvider.GetUtcNow().UtcDateTime,
                    RequestId = requestId
                };
                await context.Response.WriteAsJsonAsync(envelope);
            }
            catch (DbUpdateException ex)
            {
                if (context.Response.HasStarted) throw;

                // Unique-constraint / primary-key violation (duplicate e-mail,
                // colliding business number, …) — the contract says
                // 409 CONFLICT, not a generic 500.
                context.Response.Body = originalBody;
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                context.Response.ContentType = "application/json; charset=utf-8";
                context.Response.Headers.ContentLength = null;

                var isDevelopment = context.RequestServices
                    .GetService<IHostEnvironment>()?.IsDevelopment() == true;

                var envelope = new ApiResponse<object>
                {
                    Success = false,
                    Error = new ApiError
                    {
                        Code = ErrorCodes.Conflict,
                        Message = DefaultMessage(StatusCodes.Status409Conflict),
                        Details = isDevelopment ? ex.ToString() : null
                    },
                    Timestamp = _timeProvider.GetUtcNow().UtcDateTime,
                    RequestId = requestId
                };
                await context.Response.WriteAsJsonAsync(envelope);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                if (context.Response.HasStarted) throw;

                // Unhandled exception from below — emit an envelope-shaped 500
                // instead of letting the raw exception bubble (which would break
                // the client contract).
                context.Response.Body = originalBody;
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/json; charset=utf-8";
                context.Response.Headers.ContentLength = null;

                var isDevelopment = context.RequestServices
                    .GetService<IHostEnvironment>()?.IsDevelopment() == true;

                var envelope = new ApiResponse<object>
                {
                    Success = false,
                    Error = new ApiError
                    {
                        Code = ErrorCodes.Internal,
                        Message = "An unexpected error occurred.",
                        Details = isDevelopment ? ex.ToString() : null
                    },
                    Timestamp = _timeProvider.GetUtcNow().UtcDateTime,
                    RequestId = requestId
                };
                await context.Response.WriteAsJsonAsync(envelope);
            }
        }

        private ApiResponse<object> BuildEnvelope(int statusCode, byte[] bodyBytes, string requestId)
        {
            var success = statusCode is >= 200 and < 300;
            var envelope = new ApiResponse<object>
            {
                Success = success,
                Timestamp = _timeProvider.GetUtcNow().UtcDateTime,
                RequestId = requestId
            };

            if (success)
            {
                if (bodyBytes.Length > 0)
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(bodyBytes);
                        // Box the JsonElement so Data stays `object?` — a raw
                        // JsonElement on an unconstrained T? would default to
                        // ValueKind.Undefined and break serialization.
                        envelope.Data = doc.RootElement.Clone();
                    }
                    catch (JsonException)
                    {
                        // A 2xx with a non-JSON body (plain-text, streaming blob)
                        // must not explode into a 500 — carry it through as a
                        // string so the client still gets the payload.
                        envelope.Data = System.Text.Encoding.UTF8.GetString(bodyBytes);
                    }
                }
                return envelope;
            }

            // Error path: pull a human message from the shapes controllers use
            // today — BadRequest("string"), Unauthorized(new { error = "..." }),
            // NotFound(new { error = "..." }) — falling back to a status default.
            envelope.Error = new ApiError
            {
                Code = MapStatusCode(statusCode),
                Message = ExtractErrorMessage(bodyBytes) ?? DefaultMessage(statusCode)
            };
            return envelope;
        }

        private static string? ExtractErrorMessage(byte[] bodyBytes)
        {
            if (bodyBytes.Length == 0)
                return null;

            try
            {
                using var doc = JsonDocument.Parse(bodyBytes);
                var root = doc.RootElement;

                if (root.ValueKind == JsonValueKind.String)
                    return root.GetString();

                if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("error", out var error))
                {
                    if (error.ValueKind == JsonValueKind.String)
                        return error.GetString();

                    if (error.ValueKind == JsonValueKind.Object &&
                        error.TryGetProperty("message", out var message) &&
                        message.ValueKind == JsonValueKind.String)
                        return message.GetString();
                }

                // RFC 7807 ProblemDetails (ASP.NET model-validation 400s):
                // { "title": "...", "status": 400, "detail": "...", "errors": { ... } }.
                if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("title", out var title))
                {
                    // The default ValidationProblemDetails parks per-field messages
                    // in "errors" — surface those when present (they name the fields).
                    if (root.TryGetProperty("errors", out var errors) &&
                        errors.ValueKind == JsonValueKind.Object)
                    {
                        var parts = new List<string>();
                        foreach (var field in errors.EnumerateObject())
                        {
                            if (field.Value.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var item in field.Value.EnumerateArray())
                                {
                                    if (item.ValueKind == JsonValueKind.String)
                                        parts.Add($"{field.Name}: {item.GetString()}");
                                }
                            }
                        }
                        if (parts.Count > 0)
                            return string.Join(" ", parts.Take(5));
                    }

                    // Otherwise prefer the concrete validation detail over the generic title.
                    if (root.TryGetProperty("detail", out var detail) &&
                        detail.ValueKind == JsonValueKind.String &&
                        !string.IsNullOrWhiteSpace(detail.GetString()))
                        return detail.GetString();

                    if (title.ValueKind == JsonValueKind.String)
                        return title.GetString();
                }
            }
            catch (JsonException)
            {
                // BadRequest("string") serializes as raw text/plain, not a JSON
                // string, so parse fails — carry short plain bodies through as
                // the message and leave anything else (HTML error pages, blobs)
                // to the status default.
                var text = System.Text.Encoding.UTF8.GetString(bodyBytes).Trim();
                if (text.Length > 0 && text.Length <= 500 && text[0] != '<')
                    return text;
            }

            return null;
        }

        private static string MapStatusCode(int statusCode) => statusCode switch
        {
            StatusCodes.Status400BadRequest => ErrorCodes.Validation,
            StatusCodes.Status401Unauthorized => ErrorCodes.Unauthorized,
            StatusCodes.Status403Forbidden => ErrorCodes.Forbidden,
            StatusCodes.Status404NotFound => ErrorCodes.NotFound,
            StatusCodes.Status409Conflict => ErrorCodes.Conflict,
            StatusCodes.Status429TooManyRequests => ErrorCodes.RateLimited,
            _ => ErrorCodes.Internal
        };

        private static string DefaultMessage(int statusCode) => statusCode switch
        {
            StatusCodes.Status400BadRequest => "The request was invalid.",
            StatusCodes.Status401Unauthorized => "Authentication is required.",
            StatusCodes.Status403Forbidden => "You do not have permission to perform this action.",
            StatusCodes.Status404NotFound => "The requested resource was not found.",
            StatusCodes.Status409Conflict => "The request conflicts with the current state of the resource.",
            StatusCodes.Status429TooManyRequests => "Too many requests. Please slow down and try again shortly.",
            _ => "An unexpected error occurred."
        };
    }
}
