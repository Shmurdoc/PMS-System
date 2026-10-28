namespace Aquri.Application.Common
{
    /// <summary>Paged list result returned by every list endpoint.</summary>
    public sealed class PagedResult<T>
    {
        public List<T> Data { get; init; } = new();
        public int TotalCount { get; init; }
        public int Page { get; init; }
        public int PageSize { get; init; }
        public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
    }
}
