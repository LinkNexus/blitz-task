using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace BlitzTask.Backend.Infrastructure.Data;

/// <summary>
/// Stores a <see cref="DateTimeOffset"/> as a UTC <see cref="DateTime"/>.
/// <para>
/// SQLite has no date type, so EF writes a bare DateTimeOffset as text like
/// <c>2026-07-02 22:00:00+00:00</c>. Two things follow, and both bite at request time rather
/// than at compile time: SQLite cannot <c>ORDER BY</c> such a column at all (EF throws
/// <see cref="NotSupportedException"/>), and comparing one in a <c>WHERE</c> silently degrades
/// to a *text* comparison, which is correct only while every row happens to carry the same
/// offset. Normalising to UTC on the way in makes both work in SQL.
/// </para>
/// <para>
/// The offset itself is not information this app has ever used — every date is an instant, and
/// the SPA renders in the viewer's local time regardless — so collapsing it loses nothing.
/// </para>
/// </summary>
public class UtcDateTimeOffsetConverter : ValueConverter<DateTimeOffset, DateTime>
{
    public UtcDateTimeOffsetConverter()
        : base(
            offset => offset.UtcDateTime,
            // Read back as an explicitly-UTC instant. Without SpecifyKind the DateTime comes out
            // Unspecified and DateTimeOffset would reinterpret it in the server's local zone,
            // shifting every date by the host's offset.
            value => new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Utc))
        ) { }
}
