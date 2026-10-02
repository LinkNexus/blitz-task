using BlitzTask.Backend.Features.Projects;
namespace BlitzTask.Backend.Features.Search
{
    /// <summary>
    /// Everything one query found, grouped by what kind of thing it is.
    /// <para>
    /// Grouped rather than one ranked list, because ranking *across* kinds means inventing an
    /// exchange rate between "a project called Alpha" and "a comment mentioning alpha", and any
    /// number picked for that is arbitrary. Three short lists say what was found without
    /// pretending to an order nobody can justify.
    /// </para>
    /// </summary>
    public record SearchResults(
        List<TaskSearchResult> Tasks,
        List<ProjectSearchResult> Projects,
        List<CommentSearchResult> Comments
    )
    {
        public static SearchResults Empty => new([], [], []);

        public int Total => Tasks.Count + Projects.Count + Comments.Count;
    }

    public record TaskSearchResult(
        int Id,
        string Name,
        int ProjectId,
        string ProjectName,
        /// <summary>
        /// The owning project's accent, so a row in a list that mixes projects can be marked as
        /// belonging to one. Denormalised beside the name for the same reason the name is: the
        /// alternative is the client holding a project lookup for screens that never load a
        /// project. See <see cref="Projects.ProjectAccent"/> — it is a mark, never ink.
        /// </summary>
        ProjectAccent Accent,
        string ColumnName,
        /// <summary>So a hit in an Inbox capture links to /inbox rather than to a hidden board.</summary>
        bool IsInbox
    );

    public record ProjectSearchResult(int Id, string Name, string Description);

    public record CommentSearchResult(
        int Id,
        int TaskId,
        string TaskName,
        int ProjectId,
        bool IsInbox,
        string AuthorName,
        /// <summary>The matching part of the body, not the whole of it — see <c>Excerpt</c>.</summary>
        string Excerpt,
        DateTime CreatedAt
    );

    public static class SearchLimits
    {
        /// <summary>
        /// Per group, not overall. A search that returned forty tasks and no projects would hide
        /// the project that was being looked for.
        /// </summary>
        public const int DefaultPerGroup = 10;
        public const int MaxPerGroup = 25;

        /// <summary>
        /// Below this a query matches most of the database and answers nothing. Two characters
        /// is enough for initials and short names, which people do search for.
        /// </summary>
        public const int MinQueryLength = 2;
    }
}
