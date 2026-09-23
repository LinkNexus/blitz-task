using BlitzTask.Backend.Features.Export;

namespace BlitzTask.Backend.Tests.Features.Export;

/// <summary>
/// The two escaping rules the export rests on. One is bookkeeping; the other is the reason a
/// downloaded spreadsheet is not a way to run whatever a collaborator typed into a task title.
/// </summary>
public class CsvWriterTests
{
    [Theory]
    [InlineData("plain", "plain")]
    [InlineData("", "")]
    [InlineData(null, "")]
    public void PassesOrdinaryTextThrough(string? input, string expected) =>
        Assert.Equal(expected, CsvWriter.Field(input));

    [Theory]
    [InlineData("a,b", "\"a,b\"")]
    [InlineData("say \"hi\"", "\"say \"\"hi\"\"\"")]
    [InlineData("line\nbreak", "\"line\nbreak\"")]
    public void QuotesWhatWouldOtherwiseShiftTheRow(string input, string expected) =>
        // Descriptions are markdown, so commas and newlines are the common case rather than the
        // edge one — unquoted, every later column of that row lands in the wrong place.
        Assert.Equal(expected, CsvWriter.Field(input));

    [Theory]
    [InlineData("=1+1")]
    [InlineData("+1")]
    [InlineData("-1")]
    [InlineData("@SUM(A1)")]
    public void NeutralisesFormulasSoASharedExportCannotRunThem(string input)
    {
        // Excel and Sheets execute a cell starting with any of these on open. The values here
        // are task names and comments — text a collaborator controls.
        var field = CsvWriter.Field(input);
        Assert.StartsWith("'", field);
        Assert.Contains(input, field);
    }

    [Fact]
    public void QuotesAFormulaThatAlsoNeedsQuoting()
    {
        // Both rules at once, in this order: the apostrophe goes on first and is then wrapped,
        // rather than the quote landing between the guard and the text it is guarding.
        Assert.Equal("\"'=a,b\"", CsvWriter.Field("=a,b"));
    }

    [Fact]
    public void WritesABomAndCrlfRows()
    {
        var csv = CsvWriter.Write(["A", "B"], [["1", "2"], ["3", "4"]]);

        // Without the BOM every accented name opens as mojibake in Excel, which reads as a
        // broken export rather than as a guessed encoding.
        Assert.StartsWith(CsvWriter.Bom, csv);
        Assert.Equal($"{CsvWriter.Bom}A,B\r\n1,2\r\n3,4\r\n", csv);
    }
}
