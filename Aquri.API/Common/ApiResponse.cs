namespace Aquri.API.Common
{
    /// <summary>Standard response envelope for every API endpoint. Matches the frontend contract in employee2/app/src/lib/api.ts (ApiResponse&lt;T&gt;): the client unwraps { success, data, error, timestamp, requestId } on every response, including 401/403/404/500.</summary>
    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
        public ApiError? Error { get; set; }
        public DateTime Timestamp { get; set; }
        public string RequestId { get; set; } = string.Empty;
    }

    /// <summary>Non-generic envelope for endpoints that return no payload.</summary>
    public class ApiResponse : ApiResponse<object>
    {
    }

    /// <summary>Error payload carried on failed responses.</summary>
    public class ApiError
    {
        public string Code { get; set; } = ErrorCodes.Internal;
        public string Message { get; set; } = string.Empty;
        public string? Details { get; set; }
    }

    /// <summary>Stable machine-readable error codes returned in <see cref="ApiError.Code"/>. The frontend maps these to user-facing copy — never rename without a version bump.</summary>
    public static class ErrorCodes
    {
        public const string Validation = "VALIDATION";
        public const string Unauthorized = "UNAUTHORIZED";
        public const string Forbidden = "FORBIDDEN";
        public const string NotFound = "NOT_FOUND";
        public const string Conflict = "CONFLICT";
        public const string RateLimited = "RATE_LIMITED";
        public const string Internal = "INTERNAL";
    }
}
