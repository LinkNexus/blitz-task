using System.Text.Json.Serialization;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.Activity
{
    /// <summary>
    /// What happened, as opposed to what is. Every entity already carries <c>CreatedAt</c> and
    /// <c>UpdatedAt</c> through <see cref="IAuditable"/>, which answers "when was this last
    /// touched" and nothing else — not who, not what changed, and not the one event a board
    /// actually cares about, which is a task crossing into the last column.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter<ActivityKind>))]
    public enum ActivityKind
    {
        TASK_CREATED,
        TASK_MOVED,

        /// <summary>
        /// A move into the project's last column. Its own kind rather than a <c>TASK_MOVED</c>
        /// the reader has to decode: completion is a *position* in this app, so the only thing
        /// that distinguishes "finished it" from "shuffled it" is knowledge of where that column
        /// sits — knowledge the handler has and a feed row never would.
        /// </summary>
        TASK_COMPLETED,
        TASK_DELETED,
        TASK_RESTORED,
        COMMENT_ADDED,
        MEMBER_ADDED,
        MEMBER_REMOVED,
        MEMBER_ROLE_CHANGED,
    }

    /// <summary>
    /// One thing someone did, recorded where it happened.
    /// <para>
    /// <b>Written explicitly by handlers, never derived from the change tracker.</b> Diffing
    /// EF's tracked entities looks like it would give this for free and gives the wrong thing:
    /// it can see that <c>RelatedColumnId</c> and <c>Score</c> changed but not that the task was
    /// *finished*, it cannot tell a recurrence successor from a task someone typed, and it would
    /// faithfully report a reminder's <c>RemindAt</c> being recomputed as something a person did.
    /// A feed is a record of intent, and intent only exists in the handler.
    /// </para>
    /// <para>
    /// Every label is <b>denormalised at write time</b>, for the same reason L30 stores a
    /// comment's <c>AuthorName</c>: history that resolves ids at read time is not history. The
    /// column a task was moved out of gets renamed, the member who was removed is no longer a
    /// participant to look up, and the task itself is eventually purged — an entry that says
    /// "moved to In Progress" has to keep saying so.
    /// </para>
    /// </summary>
    public class ActivityEvent : ICreateable
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }

        /// <summary>
        /// The task this was about, or null for something that happened to the project itself.
        /// Set to null rather than cascaded when the task is finally purged, so "who deleted it"
        /// survives the thing it is about — which is exactly when that question gets asked.
        /// </summary>
        public int? TaskId { get; set; }

        public int ActorId { get; set; }
        public required string ActorName { get; set; }
        public ActivityKind Kind { get; set; }

        /// <summary>What was acted on — a task's name, or the member's. Never an id.</summary>
        public string? Subject { get; set; }

        /// <summary>
        /// The two sides of a transition, already in words: column names for a move, roles for a
        /// role change. One generic pair rather than a typed payload per kind, because every
        /// event worth recording so far is "X went from A to B" and the alternative is a JSON
        /// blob that nothing can query and every reader has to guess the shape of.
        /// </summary>
        public string? FromLabel { get; set; }
        public string? ToLabel { get; set; }

        public DateTime CreatedAt { get; set; }

        public Project Project { get; set; } = null!;
        public ProjectTask? Task { get; set; }
        public User Actor { get; set; } = null!;
    }

    /// <summary>A feed row. The DTO is the entity minus its navigations — there is nothing to
    /// compute, because everything was resolved when the event was written.</summary>
    public record ActivityEntry(
        int Id,
        ActivityKind Kind,
        int ActorId,
        string ActorName,
        int? TaskId,
        string? Subject,
        string? FromLabel,
        string? ToLabel,
        DateTime CreatedAt
    );

    public static class ActivityFeed
    {
        /// <summary>
        /// How much history one request may ask for. A feed is the one list here with no natural
        /// end — it only grows — so the cap is what stands in for the window L28's calendar gets
        /// from its date range.
        /// </summary>
        public const int MaxPageSize = 100;
        public const int DefaultPageSize = 50;
    }
}
