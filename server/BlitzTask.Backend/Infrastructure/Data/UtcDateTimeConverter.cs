using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace BlitzTask.Backend.Infrastructure.Data;

/// <summary>
/// Reads a stored <see cref="DateTime"/> back as an explicitly-UTC instant.
/// <para>
/// A no-op on the way in — every <c>DateTime</c> in this app is already written as
/// <see cref="DateTime.UtcNow"/> — and the whole point is the way out. SQLite hands values back
/// with <see cref="DateTimeKind.Unspecified"/>, and System.Text.Json writes an Unspecified
/// DateTime with **no trailing <c>Z</c>**: <c>2026-09-17T19:46:41</c>. The browser then parses
/// that as *local* time, so every timestamp the API sends is silently wrong by the viewer's
/// offset.
/// </para>
/// <para>
/// Invisible for years because nothing rendered these fields as a time. <c>CreatedAt</c> and
/// <c>UpdatedAt</c> were sorted on (server-side, where Kind does not affect comparison) but
/// never shown; the first screen to print one as *relative* time — a comment saying "about 2
/// hours ago" the moment it was posted, on a UTC+2 machine — is what surfaced it.
/// </para>
/// <para>
/// The <see cref="DateTimeOffset"/> half of this problem was already solved, for exactly the
/// same reason, in <see cref="UtcDateTimeOffsetConverter"/>. This is its missing twin.
/// </para>
/// </summary>
public class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
{
    public UtcDateTimeConverter()
        : base(
            value => value,
            value => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        ) { }
}
