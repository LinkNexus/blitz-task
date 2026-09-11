using System.Text.Json.Serialization;
using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    [JsonConverter(typeof(JsonStringEnumConverter<ProjectTaskPriority>))]
    public enum ProjectTaskPriority
    {
        LOW,
        MEDIUM,
        HIGH,
        URGENT,
    }

    public class ProjectTask : IAuditable, ISoftDeletable
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public required string Description { get; set; }
        public ProjectTaskPriority Priority { get; set; }
        public required int RelatedColumnId { get; set; }
        public required int RelatedProjectId { get; set; }
        public required float Score { get; set; }
        public List<string> Tags { get; set; } = [];
        public DateTimeOffset? StartDate { get; set; }
        public DateTimeOffset? DueDate { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }

        public ICollection<User> Assignees { get; set; } = [];
        public ProjectColumn RelatedColumn { get; set; } = null!;
        public Project RelatedProject { get; set; } = null!;
        public ICollection<Attachment> Attachments { get; set; } = [];
        public ICollection<TaskReminder> Reminders { get; set; } = [];
        public ICollection<TaskChecklistItem> ChecklistItems { get; set; } = [];
        public TaskRecurrence? Recurrence { get; set; }

        /// <summary>
        /// When this instance spawned its successor. The guard that makes materialising the next
        /// occurrence idempotent: completion is a *position* in this app, so dragging a task out
        /// of the last column and back in again is an ordinary thing to do, and each of those
        /// drops would otherwise mint another instance.
        /// </summary>
        public DateTime? RecurrenceSpawnedAt { get; set; }

        public static int MaxRemindersCount => 5;
        public static int MaxTagsCount => 5;
        public static int MaxTagsLength => 20;
        public static int MaxAttachmentsCount => 5;
        public static int MaxRecurrenceInterval => 365;
        public static int MaxChecklistItemsCount => 20;
        public static int MaxChecklistItemLength => 200;
    }

    public class ProjectTaskAttachment
    {
        public int ProjectTaskId { get; set; }
        public Guid AttachmentId { get; set; }
    }

    public record CreateProjectTaskRequest
    {
        public string Name { get; set; } = null!;
        public string Description { get; set; } = null!;
        public ProjectTaskPriority Priority { get; set; }
        public List<string>? Tags { get; set; } = [];
        public DateTimeOffset? StartDate { get; set; }
        public DateTimeOffset? DueDate { get; set; }
        public List<int>? AssigneeIds { get; set; } = [];
        public List<IFormFile>? Attachments { get; set; } = [];

        /// <summary>
        /// Reminder offsets, in minutes before the due date, for the <b>caller</b> — a reminder
        /// is a personal intention, so a request can only ever set its own. Carried on the task
        /// request rather than left to <c>POST .../reminders</c> because that endpoint needs a
        /// task that already exists with a due date already saved, which forced "save, reopen,
        /// then add a reminder" for what is one thought.
        /// </summary>
        public List<int>? ReminderMinutesBeforeDue { get; set; } = [];

        /// <summary>
        /// The task's checklist, in the order it should read. Carried here rather than left to
        /// the checklist endpoint for the same reason as reminders: a task being created has no
        /// id yet, so anything needing one could not be offered on a new task at all.
        /// <para>
        /// Text and order only — an item's ticked state is never submitted here, so nothing about
        /// saving a task can change it.
        /// </para>
        /// </summary>
        public List<ChecklistItemInput>? ChecklistItems { get; set; } = [];

        /// <summary>
        /// How the task repeats, or null for a one-off. Only the next occurrence is ever
        /// materialised, so this is the rule and not a schedule: completing the task is what
        /// writes the following instance.
        /// </summary>
        public RecurrenceInput? Recurrence { get; set; }
    }

    public record MoveProjectTaskRequest(int ColumnId, float Score);

    public record UpdateProjectTaskRequest
    {
        public string Name { get; set; } = null!;
        public string Description { get; set; } = null!;
        public ProjectTaskPriority Priority { get; set; }
        public List<string>? Tags { get; set; } = [];
        public DateTimeOffset? StartDate { get; set; }
        public DateTimeOffset? DueDate { get; set; }
        public List<int>? AssigneeIds { get; set; } = [];
        public List<IFormFile>? NewAttachments { get; set; }
        public List<Guid>? RemovedAttachmentIds { get; set; }

        /// <summary>
        /// The caller's reminder offsets, in minutes before the due date. **Replaces** whatever
        /// they had on this task, matching how this PUT already treats <c>Tags</c>: it is a full
        /// representation, so an absent list means none. Other members' reminders on the same
        /// task are never touched.
        /// <para>
        /// Ignored entirely while the task has no due date, so that clearing a deadline keeps
        /// the reminders rather than dropping them — the sweep will not fire a reminder without
        /// a due date, and setting the deadline again brings them back.
        /// </para>
        /// </summary>
        public List<int>? ReminderMinutesBeforeDue { get; set; } = [];

        /// <summary>
        /// The task's checklist, in the order it should read. A full representation like
        /// <c>Tags</c>: an absent list means the task has none.
        /// <para>
        /// **Reconciled, not rebuilt.** An item already on the task carries its id, and the
        /// handler matches on it — so the item keeps the row it had, and with it the ticked state
        /// this request never mentions. Rebuilding the list would silently untick everything on
        /// every save.
        /// </para>
        /// </summary>
        public List<ChecklistItemInput>? ChecklistItems { get; set; } = [];

        /// <summary>
        /// How the task repeats. A full representation like the rest of this request: null means
        /// the task does not repeat, and clears any rule it had.
        /// <para>
        /// Editing the rule only affects occurrences not yet written. The instance in front of
        /// you is a row like any other, so there is no series to rewrite — which is the trade
        /// materialise-next makes, and the reason it leaves every existing query alone.
        /// </para>
        /// </summary>
        public RecurrenceInput? Recurrence { get; set; }
    }

    /// <summary>
    /// A task as seen from outside its project — the dashboard's "my tasks" list. Carries the
    /// project and column it belongs to, because a cross-project list is meaningless without
    /// them, and drops attachments and description-level detail, which a list never renders.
    /// </summary>
    /// <summary>
    /// Files a task into a project — the way out of the Inbox. <c>ColumnId</c> is optional
    /// because the caller filing a capture has no opinion about status: unset means the target
    /// project's first column.
    /// </summary>
    public record FileTaskRequest(int ProjectId, int? ColumnId);

    public record UserTaskSummary(
        int Id,
        string Name,
        string Description,
        ProjectTaskPriority Priority,
        List<string> Tags,
        DateTimeOffset? StartDate,
        DateTimeOffset? DueDate,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        List<int> AssigneeIds,
        int ProjectId,
        string ProjectName,
        int ColumnId,
        string ColumnName,
        string ColumnColor,
        bool IsCompleted,
        // So a list row knows to link an Inbox capture to /inbox rather than to a board the
        // user is not supposed to be managing.
        bool IsInbox
    );

    public record ProjectTaskDetails(
        int Id,
        string Name,
        string Description,
        ProjectTaskPriority Priority,
        float Score,
        List<string> Tags,
        DateTimeOffset? StartDate,
        DateTimeOffset? DueDate,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        List<int> AssigneeIds,
        List<AttachmentMetadata> Attachments,
        int ColumnId,
        List<ChecklistItemDetails> ChecklistItems,
        RecurrenceDetails? Recurrence
    );
}
