namespace Aquri.Application.Common
{
    /// <summary>
    /// Non-generic result: signals success/failure without returning data.
    /// </summary>
    public class Result
    {
        public bool Success { get; init; }
        public string? Error { get; init; }
        public bool NotFound { get; init; }

        /// <summary>
        /// 409 CONFLICT — an invariant guard rejected the operation
        /// (referential dependencies, duplicate identity, admin lockout).
        /// Controllers map this to Conflict(); the envelope middleware
        /// assigns the CONFLICT error code.
        /// </summary>
        public bool Conflict { get; init; }

        public static Result Ok() => new() { Success = true };
        public static Result Failure(string error) => new() { Success = false, Error = error };
        public static Result NotFoundResult() => new() { Success = false, NotFound = true };
        public static Result ConflictResult(string error) => new() { Success = false, Conflict = true, Error = error };
    }

    /// <summary>
    /// Generic result: encapsulates success/failure for a command or query
    /// without leaking domain entities across the Application boundary.
    /// </summary>
    public class Result<T> : Result
    {
        public T? Data { get; init; }

        public static Result<T> SuccessResult(T data) => new() { Success = true, Data = data };
        public new static Result<T> Failure(string error) => new() { Success = false, Error = error };
        public new static Result<T> NotFoundResult() => new() { Success = false, NotFound = true };
        public new static Result<T> ConflictResult(string error) => new() { Success = false, Conflict = true, Error = error };
    }
}
