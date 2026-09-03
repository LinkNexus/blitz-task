using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlitzTask.Backend.Migrations
{
    /// <summary>
    /// Rewrites existing due/start dates from offset-bearing text to UTC, to match the
    /// UtcDateTimeOffsetConverter now applied to every DateTimeOffset.
    /// <para>
    /// There is no schema change to make and that is the danger: SQLite is dynamically typed and
    /// EF maps both DateTimeOffset and DateTime to TEXT, so EF generated an **empty** migration
    /// here. Left alone, rows written as <c>2026-07-02 22:00:00+00:00</c> would stay exactly as
    /// they are while EF started reading the column as a DateTime. The data rewrite *is* the
    /// migration.
    /// </para>
    /// </summary>
    public partial class StoreDateTimeOffsetsAsUtc : Migration
    {
        private static readonly (string Table, string Column)[] Columns =
        [
            ("Projects", "StartDate"),
            ("Projects", "DueDate"),
            ("ProjectTasks", "StartDate"),
            ("ProjectTasks", "DueDate"),
        ];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var (table, column) in Columns)
            {
                // strftime applies the trailing offset and returns UTC, so this converts
                // +02:00 values to the right instant rather than just truncating the suffix.
                // It is a no-op on already-offsetless text, which keeps the migration safe to
                // re-run, and the IS NOT NULL guard means anything strftime cannot parse is
                // left alone rather than silently nulled.
                migrationBuilder.Sql(
                    $"""
                    UPDATE "{table}"
                    SET "{column}" = strftime('%Y-%m-%d %H:%M:%f', "{column}")
                    WHERE "{column}" IS NOT NULL
                      AND strftime('%Y-%m-%d %H:%M:%f', "{column}") IS NOT NULL;
                    """
                );
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var (table, column) in Columns)
            {
                // The original offset is not recoverable — it was collapsed to UTC on the way
                // in — so this restores the shape EF expects for a bare DateTimeOffset, with
                // every value explicitly at +00:00.
                migrationBuilder.Sql(
                    $"""
                    UPDATE "{table}"
                    SET "{column}" = strftime('%Y-%m-%d %H:%M:%f', "{column}") || '+00:00'
                    WHERE "{column}" IS NOT NULL
                      AND strftime('%Y-%m-%d %H:%M:%f', "{column}") IS NOT NULL;
                    """
                );
            }
        }
    }
}
