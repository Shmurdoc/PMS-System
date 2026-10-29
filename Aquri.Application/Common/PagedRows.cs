namespace Aquri.Application.Common
{
    /// <summary>
    /// Carries a sliced page of rows plus the total count from a handler to
    /// its controller. This is an internal shape: controllers unwrap it and
    /// keep the HTTP body as a plain array, surfacing the paging metadata in
    /// X-Total-Count / X-Page / X-Page-Size headers so existing API clients
    /// keep working unchanged.
    /// </summary>
    public sealed class PagedRows<T>
    {
        public List<T> Data { get; init; } = new();
        public int TotalCount { get; init; }
        public int Page { get; init; }
        public int PageSize { get; init; }
    }
}
