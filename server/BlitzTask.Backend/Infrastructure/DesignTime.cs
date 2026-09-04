using System.Reflection;

namespace BlitzTask.Backend.Infrastructure
{
    /// <summary>
    /// Tells a real run apart from the build-time OpenAPI document generation.
    /// </summary>
    /// <remarks>
    /// `dotnet build` runs `GetDocument.Insider`, which loads this assembly and actually
    /// **starts the host** to read the API surface off it. Everything a startup does therefore
    /// happens on an ordinary build: migrations apply to whichever database the developer has
    /// configured, and hosted services tick. That was observed rather than theorised — a build
    /// log carried `Failed to send reminder 2 to hello@example.com`, naming a real row in a
    /// local dev database (ROADMAP L24.6).
    /// </remarks>
    public static class DesignTime
    {
        /// <summary>The entry assembly the document generator runs under.</summary>
        public const string DocumentGeneratorAssemblyName = "GetDocument.Insider";

        public static bool IsDocumentGeneration =>
            IsDocumentGenerationFor(Assembly.GetEntryAssembly()?.GetName().Name);

        /// <summary>Takes the name as a parameter so the check itself is testable.</summary>
        public static bool IsDocumentGenerationFor(string? entryAssemblyName) =>
            string.Equals(
                entryAssemblyName,
                DocumentGeneratorAssemblyName,
                StringComparison.Ordinal
            );
    }
}
