using System.Text.Json.Serialization;
using BlitzTask.Backend.Features.Projects;

namespace BlitzTask.Backend.Features.Trash
{
    [JsonConverter(typeof(JsonStringEnumConverter<TrashItemKind>))]
    public enum TrashItemKind
    {
        PROJECT,
        TASK,
    }

    public static class TrashRetention
    {
        /// <summary>
        /// How long a trashed row survives before the purge takes it — and its files with it.
        /// <para>
        /// A constant rather than configuration on purpose: it is the kind of setting that looks
        /// worth exposing and then has to be honoured by the restore UI, the purge job and every
        /// message that quotes it. One number, one place, until someone actually needs two.
        /// </para>
        /// </summary>
        public static TimeSpan Window => TimeSpan.FromDays(30);

        public static DateTime PurgeAt(DateTime deletedAt) => deletedAt + Window;
    }

    /// <summary>
    /// A row on the trash screen. Projects and tasks in one list rather than two endpoints,
    /// because "where did that go" is one question — the kind is what the UI renders differently.
    /// </summary>
    public record TrashItem(
        TrashItemKind Kind,
        int Id,
        string Name,
        DateTime DeletedAt,
        DateTime PurgeAt,
        int ProjectId,
        string ProjectName,
        /// <summary>
        /// The owning project's accent, so a row in a list that mixes projects can be marked as
        /// belonging to one. Denormalised beside the name for the same reason the name is: the
        /// alternative is the client holding a project lookup for screens that never load a
        /// project. See <see cref="Projects.ProjectAccent"/> — it is a mark, never ink.
        /// </summary>
        ProjectAccent Accent,
        /// <summary>
        /// For a project, how much comes back with it. Null for a task — the count would be one,
        /// and a row saying so reads as noise.
        /// </summary>
        int? TaskCount,
        /// <summary>
        /// Whether the caller may put this back or purge it for good. The trash shows everything
        /// deleted in the projects they are in — a Contributor's mistake has to be visible to the
        /// Owner who can undo it — but seeing a row is not the same as being allowed to act on it.
        /// </summary>
        bool CanRestore
    );
}
