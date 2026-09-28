using System.Globalization;
using System.Text;

namespace BlitzTask.Backend.Features.Calendar
{
    /// <summary>
    /// Serialises calendar items as an iCalendar (RFC 5545) document.
    /// <para>
    /// Written by hand rather than taken from a library because the whole format used here is
    /// four properties on a <c>VEVENT</c>, and the two things that are actually easy to get wrong
    /// — folding and escaping — are ten lines each. A dependency would carry a hundred features
    /// this feed will never emit.
    /// </para>
    /// </summary>
    public static class IcsWriter
    {
        /// <summary>
        /// Identifies the producer of the file. Required by RFC 5545, and the first thing quoted
        /// back when a calendar client rejects a feed.
        /// </summary>
        private const string ProductId = "-//Blitz Task//Calendar Feed//EN";

        /// <summary>
        /// The longest a content line may be, in <b>octets</b>, before it has to be folded.
        /// RFC 5545 §3.1 says 75 excluding the CRLF — and the limit is bytes, not characters, so
        /// a name in Cyrillic folds twice as often as the same length in ASCII.
        /// </summary>
        private const int MaxLineOctets = 75;

        public static string Write(string calendarName, IEnumerable<IcsEvent> events, DateTime now)
        {
            var builder = new StringBuilder();

            AppendLine(builder, "BEGIN:VCALENDAR");
            AppendLine(builder, "VERSION:2.0");
            AppendLine(builder, $"PRODID:{ProductId}");
            // PUBLISH rather than REQUEST: nobody is being invited to anything, and a client that
            // reads this as an invitation offers to accept or decline a deadline.
            AppendLine(builder, "METHOD:PUBLISH");
            AppendLine(builder, "CALSCALE:GREGORIAN");
            // Not in the standard, and every major client reads it: without it a subscription is
            // named after its URL, which is a random token.
            AppendLine(builder, $"X-WR-CALNAME:{Escape(calendarName)}");

            foreach (var item in events)
            {
                AppendLine(builder, "BEGIN:VEVENT");
                AppendLine(builder, $"UID:{item.Uid}");
                AppendLine(builder, $"DTSTAMP:{FormatUtc(now)}");

                if (item.StartAt is DateTimeOffset startAt && item.EndAt is DateTimeOffset endAt)
                {
                    // A chosen time is an instant, so it goes out as UTC and needs no zone
                    // agreed with the reader.
                    AppendLine(builder, $"DTSTART:{FormatUtc(startAt.UtcDateTime)}");
                    AppendLine(builder, $"DTEND:{FormatUtc(endAt.UtcDateTime)}");
                }
                else
                {
                    // DTEND is exclusive for an all-day event, so a task due on the 23rd runs
                    // 23 -> 24. Emitting the same date twice produces a zero-length event, which
                    // Google renders on the day before.
                    AppendLine(builder, $"DTSTART;VALUE=DATE:{FormatDate(item.Start)}");
                    AppendLine(builder, $"DTEND;VALUE=DATE:{FormatDate(item.End.AddDays(1))}");
                }

                AppendLine(builder, $"SUMMARY:{Escape(item.Summary)}");

                if (!string.IsNullOrWhiteSpace(item.Description))
                    AppendLine(builder, $"DESCRIPTION:{Escape(item.Description)}");

                if (!string.IsNullOrWhiteSpace(item.Url))
                    AppendLine(builder, $"URL:{Escape(item.Url)}");

                // A completed deadline stays on the calendar — it is a record of when the thing
                // was due — but says so, and clients grey it out.
                AppendLine(builder, item.IsCompleted ? "STATUS:COMPLETED" : "STATUS:CONFIRMED");

                // A deadline does not make its owner unavailable for the whole day.
                AppendLine(builder, "TRANSP:TRANSPARENT");

                AppendLine(builder, "END:VEVENT");
            }

            AppendLine(builder, "END:VCALENDAR");

            return builder.ToString();
        }

        /// <summary>
        /// Appends one content line, folded to <see cref="MaxLineOctets"/> and terminated with
        /// CRLF.
        /// <para>
        /// The line breaks are <b>CRLF regardless of platform</b> — a bare LF is not a line ending
        /// in this format, and the failure mode is a client that reads the whole file as a single
        /// malformed property rather than one that complains.
        /// </para>
        /// </summary>
        private static void AppendLine(StringBuilder builder, string line)
        {
            var bytes = Encoding.UTF8.GetByteCount(line);

            if (bytes <= MaxLineOctets)
            {
                builder.Append(line).Append("\r\n");
                return;
            }

            // Folding cuts by octets but must never cut *inside* a character: a continuation line
            // that starts mid-sequence is not valid UTF-8, and an emoji in a task name is four
            // bytes. Walk by text element so a surrogate pair or a combining mark stays whole.
            var written = 0;
            var current = new StringBuilder();
            var enumerator = StringInfo.GetTextElementEnumerator(line);

            while (enumerator.MoveNext())
            {
                var element = (string)enumerator.Current;
                var size = Encoding.UTF8.GetByteCount(element);

                // Continuation lines carry a leading space that counts toward the limit.
                var limit = written == 0 ? MaxLineOctets : MaxLineOctets - 1;

                if (Encoding.UTF8.GetByteCount(current.ToString()) + size > limit)
                {
                    builder.Append(written == 0 ? "" : " ").Append(current).Append("\r\n");
                    current.Clear();
                    written++;
                }

                current.Append(element);
            }

            if (current.Length > 0)
                builder.Append(written == 0 ? "" : " ").Append(current).Append("\r\n");
        }

        /// <summary>
        /// Escapes a TEXT value per RFC 5545 §3.3.11.
        /// <para>
        /// The backslash has to go first or it doubles the escapes added after it. Newlines become
        /// a literal <c>\n</c> because a raw one would end the content line and turn the rest of a
        /// description into an unknown property.
        /// </para>
        /// </summary>
        private static string Escape(string value) =>
            value
                .Replace("\\", "\\\\")
                .Replace(";", "\\;")
                .Replace(",", "\\,")
                .Replace("\r\n", "\\n")
                .Replace("\n", "\\n")
                .Replace("\r", "\\n");

        private static string FormatUtc(DateTime instant) =>
            instant.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);

        private static string FormatDate(DateOnly date) =>
            date.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// One event in the feed, already reduced to calendar days.
    /// <para>
    /// <see cref="Start"/> and <see cref="End"/> are <see cref="DateOnly"/> rather than instants
    /// on purpose: deciding which day an instant falls on is the caller's job, because it needs a
    /// timezone this type has no business knowing about. See <c>CalendarEndpoints.GetIcsFeed</c>
    /// for where that decision is made and why.
    /// </para>
    /// </summary>
    public record IcsEvent(
        string Uid,
        string Summary,
        DateOnly Start,
        /// <summary>The last day the event covers, inclusive. Made exclusive when written.</summary>
        DateOnly End,
        string? Description,
        string? Url,
        bool IsCompleted,
        /// <summary>
        /// Set when the task carries a time someone chose, in which case the event is written as
        /// a timed one in UTC and <see cref="Start"/>/<see cref="End"/> are ignored.
        /// <para>
        /// This is the case the <c>?tz=</c> parameter does <b>not</b> apply to, and that is the
        /// point: an all-day event has to name a day, and the stored instant cannot say which
        /// wall clock its midnight came from, so the subscriber's zone is the only source for it.
        /// A chosen time is already an unambiguous instant — writing it as UTC is exactly right
        /// in every zone, and the client renders it in the reader's own.
        /// </para>
        /// </summary>
        DateTimeOffset? StartAt = null,
        DateTimeOffset? EndAt = null
    );
}
