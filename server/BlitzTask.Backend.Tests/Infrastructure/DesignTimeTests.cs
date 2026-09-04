using BlitzTask.Backend.Infrastructure;

namespace BlitzTask.Backend.Tests.Infrastructure;

/// <summary>
/// Pins the sentinel that keeps builds from performing side effects. Small, but the string is
/// magic and the failure it guards is silent: get it wrong and `dotnet build` quietly migrates
/// the developer's database and starts sending mail again.
/// </summary>
public class DesignTimeTests
{
    [Fact]
    public void RecognisesTheDocumentGeneratorEntryAssembly()
    {
        // Measured, not guessed: during `dotnet build` the entry assembly really is this.
        Assert.True(DesignTime.IsDocumentGenerationFor("GetDocument.Insider"));
    }

    [Theory]
    [InlineData("BlitzTask.Backend")]
    [InlineData("getdocument.insider")] // case-sensitive on purpose — this is an assembly name
    [InlineData("")]
    [InlineData(null)]
    public void TreatsEverythingElseAsARealRun(string? entryAssemblyName)
    {
        // Defaulting to "real run" is the safe direction: a false positive would silently
        // disable migrations and the scheduler in production.
        Assert.False(DesignTime.IsDocumentGenerationFor(entryAssemblyName));
    }

    [Fact]
    public void UnderTheTestHostThisIsARealRun()
    {
        Assert.False(DesignTime.IsDocumentGeneration);
    }
}
