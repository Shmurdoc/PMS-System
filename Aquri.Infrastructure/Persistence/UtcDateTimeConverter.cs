using System;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Aquri.Infrastructure.Persistence
{
    /// <summary>
    /// Normalises every <see cref="DateTime"/> to UTC before it is sent to PostgreSQL.
    /// The schema stores all timestamps as <c>timestamp with time zone</c>, and Npgsql
    /// rejects <see cref="DateTimeKind.Unspecified"/> values (e.g. date-only JSON such as
    /// "2026-10-17" produced by the UI). Relabelling to UTC keeps the wall-clock value
    /// intact while satisfying Npgsql's UTC-only contract.
    /// </summary>
    public class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
    {
        public UtcDateTimeConverter()
            : base(
                v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc),
                v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc))
        {
        }
    }

    /// <summary>Nullable counterpart of <see cref="UtcDateTimeConverter"/>.</summary>
    public class NullableUtcDateTimeConverter : ValueConverter<DateTime?, DateTime?>
    {
        public NullableUtcDateTimeConverter()
            : base(
                v => v.HasValue ? Normalize(v.Value) : v,
                v => v.HasValue ? Normalize(v.Value) : v)
        {
        }

        private static DateTime Normalize(DateTime value) =>
            value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }
}
