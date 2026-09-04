using BlitzTask.Backend.Features.Auth;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    /// <summary>
    /// "Tell me before this is due." Private to the user who created it, even though the task is
    /// shared — a reminder is a personal intention, not a property of the work.
    /// </summary>
    public class TaskReminder
    {
        public int Id { get; set; }
        public int ProjectTaskId { get; set; }
        public int UserId { get; set; }

        /// <summary>
        /// How long before the due date to fire. This is the <b>intent</b> and the source of
        /// truth: expressing it relatively is what lets a reminder survive the due date moving,
        /// which a stored timestamp alone cannot.
        /// </summary>
        public int MinutesBeforeDue { get; set; }

        /// <summary>
        /// Derived from the task's due date and <see cref="MinutesBeforeDue"/>, and recomputed
        /// whenever either changes. It exists only so the sweep can be a plain indexed range
        /// query — computing <c>DueDate - offset</c> per row inside SQL is not translatable, and
        /// doing it in memory would mean loading every unsent reminder on every tick.
        /// </summary>
        public DateTime RemindAt { get; set; }

        /// <summary>
        /// When this last fired. Null means never. Compared against
        /// <see cref="RemindAt"/> rather than merely checked for null, so pushing a due date
        /// forward re-arms an already-sent reminder instead of silently swallowing it.
        /// </summary>
        public DateTime? SentAt { get; set; }

        public ProjectTask ProjectTask { get; set; } = null!;
        public User User { get; set; } = null!;

        /// <summary>The reminder's firing time for a given due date. One definition, one place.</summary>
        public static DateTime ResolveRemindAt(DateTimeOffset dueDate, int minutesBeforeDue) =>
            dueDate.UtcDateTime.AddMinutes(-minutesBeforeDue);
    }

    public record CreateTaskReminderRequest(int MinutesBeforeDue);

    public record TaskReminderDetails(
        int Id,
        int MinutesBeforeDue,
        DateTime RemindAt,
        DateTime? SentAt
    );

    /// <summary>Model for <c>Templates/Email/TaskReminder.cshtml</c>.</summary>
    public record TaskReminderEmailModel(
        string UserName,
        string TaskName,
        string ProjectName,
        string DueDateText,
        string TaskLink
    );
}
