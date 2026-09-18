using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.TaskComments
{
    /// <summary>
    /// Something a person said about a task.
    /// <para>
    /// The first thing in this app that is neither the work nor a property of it. A checklist
    /// item (L26) describes what has to happen and everyone sees the same state; a reminder
    /// (L25.5) is a private intention. A comment is **attributed speech**: it belongs to the
    /// person who wrote it and stays theirs, which is why <see cref="AuthorId"/> is not a
    /// convenience for display but the thing the edit rule is built on.
    /// </para>
    /// <para>
    /// Not soft-deletable, unlike its task. L29 made deletion recoverable for the things you
    /// lose *work* by losing — a project, a column, a task. Retracting your own sentence is a
    /// deliberate act on something small, and putting it in a 30-day trash would mean a user who
    /// deleted a remark they regretted could watch it sit there for a month. The FK cascade is
    /// what carries them off when the purge job eventually hard-deletes the task.
    /// </para>
    /// </summary>
    public class TaskComment : IAuditable
    {
        /// <summary>
        /// Long enough for a real explanation, short enough that the column is not a document
        /// store. Descriptions are where a task's own detail belongs.
        /// </summary>
        public const int MaxBodyLength = 5000;

        public int Id { get; set; }
        public int ProjectTaskId { get; set; }
        public int AuthorId { get; set; }

        /// <summary>Markdown, rendered the same way a task description is.</summary>
        public required string Body { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public ProjectTask ProjectTask { get; set; } = null!;
        public User Author { get; set; } = null!;
    }

    public record CreateTaskCommentRequest(string Body);

    public record UpdateTaskCommentRequest(string Body);

    /// <summary>
    /// A comment as the task sheet renders it.
    /// </summary>
    public record TaskCommentDetails(
        int Id,
        string Body,
        int AuthorId,
        /// <summary>
        /// Denormalised rather than looked up client-side against the project's participants: a
        /// comment outlives its author's membership, and a thread whose replies lose their names
        /// the moment someone leaves the project is worse than no attribution at all.
        /// </summary>
        string AuthorName,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        /// <summary>
        /// Whether this has been changed since it was written, so the UI can say so. Derived
        /// from the timestamps here rather than in the client, which would have to know that
        /// <c>IAuditable</c> sets both to the same instant on insert.
        /// </summary>
        bool IsEdited,
        /// <summary>
        /// Only the author may rewrite their own words. Sent per row for the same reason L29's
        /// <c>CanRestore</c> and L28.5's <c>CanReschedule</c> are: the permission rules live in
        /// C# and the UI should not be a second copy of them.
        /// </summary>
        bool CanEdit,
        /// <summary>
        /// The author, or someone who runs the project. Deliberately wider than
        /// <see cref="CanEdit"/> — moderation means being able to take a remark down, never to
        /// put different words in someone's mouth.
        /// </summary>
        bool CanDelete
    );
}
