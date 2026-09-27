using System.Text;
using BlitzTask.Backend.Features.Calendar;

namespace BlitzTask.Backend.Tests.Features.Calendar;

/// <summary>
/// The iCalendar serializer. Everything here is a rule from RFC 5545 that produces a file which
/// <i>looks</i> fine in a text editor and is rejected, or silently mangled, by a calendar client —
/// which is the whole reason this has tests rather than a glance.
/// </summary>
public class IcsWriterTests
{
    private static readonly DateTime Stamp = new(2026, 6, 1, 9, 30, 0, DateTimeKind.Utc);

    private static IcsEvent Event(
        string summary = "Ship it",
        string? description = "Alpha",
        string? url = null,
        bool completed = false,
        int lengthDays = 0
    ) =>
        new(
            Uid: "task-1@blitz-task",
            Summary: summary,
            Start: new DateOnly(2026, 6, 10),
            End: new DateOnly(2026, 6, 10).AddDays(lengthDays),
            Description: description,
            Url: url,
            IsCompleted: completed
        );

    [Fact]
    public void WritesAWellFormedCalendarAroundTheEvents()
    {
        var ics = IcsWriter.Write("Linus — Blitz Task", [Event()], Stamp);

        Assert.StartsWith("BEGIN:VCALENDAR\r\n", ics);
        Assert.EndsWith("END:VCALENDAR\r\n", ics);
        Assert.Contains("VERSION:2.0\r\n", ics);
        Assert.Contains("PRODID:-//Blitz Task//Calendar Feed//EN\r\n", ics);
        Assert.Contains("DTSTAMP:20260601T093000Z\r\n", ics);
        // Named after its owner, not after the random token in its URL.
        Assert.Contains("X-WR-CALNAME:Linus — Blitz Task\r\n", ics);
    }

    [Fact]
    public void EveryLineEndsWithCarriageReturnLineFeed()
    {
        var ics = IcsWriter.Write("Cal", [Event()], Stamp);

        // A bare LF is not a line ending in this format, and a client that meets one tends to
        // read the whole file as a single malformed property rather than complain.
        Assert.DoesNotContain('\n', ics.Replace("\r\n", ""));
    }

    [Fact]
    public void EndDateIsExclusiveSoASingleDayCoversOneDay()
    {
        var ics = IcsWriter.Write("Cal", [Event()], Stamp);

        Assert.Contains("DTSTART;VALUE=DATE:20260610\r\n", ics);
        // Not 20260610. An all-day DTEND is exclusive, and writing the same date twice produces a
        // zero-length event that Google draws on the day before.
        Assert.Contains("DTEND;VALUE=DATE:20260611\r\n", ics);
    }

    [Fact]
    public void ASpanCoversEveryDayItTouches()
    {
        var ics = IcsWriter.Write("Cal", [Event(lengthDays: 3)], Stamp);

        Assert.Contains("DTSTART;VALUE=DATE:20260610\r\n", ics);
        Assert.Contains("DTEND;VALUE=DATE:20260614\r\n", ics);
    }

    [Theory]
    // The backslash has to be escaped first, or it doubles every escape added after it.
    [InlineData(@"back\slash", @"back\\slash")]
    [InlineData("semi;colon", @"semi\;colon")]
    [InlineData("comma,separated", @"comma\,separated")]
    [InlineData("two\nlines", @"two\nlines")]
    [InlineData("crlf\r\nlines", @"crlf\nlines")]
    public void EscapesTheCharactersThatWouldEndOrSplitAValue(string input, string expected)
    {
        // Through Write rather than the escaper directly: what ships is the file, and a helper
        // that escapes correctly but is never called on SUMMARY would pass either way.
        var ics = IcsWriter.Write("Cal", [Event(summary: input)], Stamp);

        Assert.Contains($"SUMMARY:{expected}", ics);
    }

    [Fact]
    public void ARawNewlineInANameCannotEndTheContentLine()
    {
        var ics = IcsWriter.Write("Cal", [Event(summary: "Ship it\nthen rest")], Stamp);

        // Had it gone through raw, "then rest" would be read as an unknown property and the
        // summary would be truncated at the break.
        Assert.Contains(@"SUMMARY:Ship it\nthen rest", ics);
    }

    [Fact]
    public void FoldsLinesLongerThanSeventyFiveOctets()
    {
        var ics = IcsWriter.Write("Cal", [Event(summary: new string('x', 200))], Stamp);

        foreach (var line in ics.Split("\r\n"))
            Assert.True(
                Encoding.UTF8.GetByteCount(line) <= 75,
                $"line of {Encoding.UTF8.GetByteCount(line)} octets: {line}"
            );

        // A folded line continues with a single leading space, which is not part of the value.
        Assert.Contains("\r\n ", ics);
        Assert.Contains(new string('x', 20), ics);
    }

    [Fact]
    public void FoldingCountsOctetsRatherThanCharacters()
    {
        // Cyrillic is two bytes per character in UTF-8, so a name that fits by character count
        // does not fit by the limit the spec actually states.
        var ics = IcsWriter.Write("Cal", [Event(summary: new string('я', 60))], Stamp);

        foreach (var line in ics.Split("\r\n"))
            Assert.True(Encoding.UTF8.GetByteCount(line) <= 75);
    }

    [Fact]
    public void NeverFoldsInsideACharacter()
    {
        // Four bytes each, so a fold that counted to 75 and cut would land mid-sequence and
        // produce a continuation line that is not valid UTF-8.
        var ics = IcsWriter.Write("Cal", [Event(summary: string.Concat(Enumerable.Repeat("🚀", 40)))], Stamp);

        var roundTripped = Encoding.UTF8.GetString(Encoding.UTF8.GetBytes(ics));
        Assert.Equal(ics, roundTripped);
        Assert.DoesNotContain('�', ics);

        // Unfolding must give the rockets back intact.
        var unfolded = ics.Replace("\r\n ", "");
        Assert.Contains(string.Concat(Enumerable.Repeat("🚀", 40)), unfolded);
    }

    [Fact]
    public void ACompletedDeadlineStaysButSaysSo()
    {
        Assert.Contains("STATUS:COMPLETED", IcsWriter.Write("Cal", [Event(completed: true)], Stamp));
        Assert.Contains("STATUS:CONFIRMED", IcsWriter.Write("Cal", [Event()], Stamp));
    }

    [Fact]
    public void ADeadlineDoesNotMakeItsOwnerBusy()
    {
        Assert.Contains("TRANSP:TRANSPARENT", IcsWriter.Write("Cal", [Event()], Stamp));
    }

    [Fact]
    public void OmitsOptionalPropertiesRatherThanWritingThemEmpty()
    {
        var ics = IcsWriter.Write("Cal", [Event(description: null, url: null)], Stamp);

        Assert.DoesNotContain("DESCRIPTION:", ics);
        Assert.DoesNotContain("URL:", ics);
    }

    [Fact]
    public void AnEmptyCalendarIsStillAValidOne()
    {
        var ics = IcsWriter.Write("Cal", [], Stamp);

        Assert.DoesNotContain("BEGIN:VEVENT", ics);
        Assert.StartsWith("BEGIN:VCALENDAR", ics);
        Assert.EndsWith("END:VCALENDAR\r\n", ics);
    }
}
