using BlitzTask.Backend.Features.ProjectTasks;

namespace BlitzTask.Backend.Features.Calendar
{
    /// <summary>
    /// One thing drawn on the calendar. Deliberately not a <c>UserTaskSummary</c>: a calendar
    /// shows two different kinds of thing, and the difference has to be in the type rather than
    /// left for a component to remember.
    /// <para>
    /// A <b>real</b> item is a task row — it has an id, it can be opened, and everything the rest
    /// of the app knows about it holds. A <b>projected</b> one is computed from a recurrence rule
    /// and <i>does not exist</i>: L25 materialises only the next occurrence, so the rest of a
    /// daily chore's month is arithmetic. It has no id of its own, cannot be opened, completed,
    /// dragged or reminded about, and <see cref="SourceTaskId"/> points at the row it was
    /// computed from.
    /// </para>
    /// </summary>
    public record CalendarItem(
        /// <summary>The task's id, or null when this occurrence has no row behind it.</summary>
        int? TaskId,
        int SourceTaskId,
        string Name,
        ProjectTaskPriority Priority,
        /// <summary>
        /// Present only when the task is a span. A calendar draws a bar across the days between
        /// this and <see cref="DueDate"/>, which is the difference between a calendar and a list.
        /// </summary>
        DateTimeOffset? StartDate,
        /// <summary>
        /// Never null, unlike on a task: an undated task has no place on a grid, so it is not a
        /// calendar item at all.
        /// </summary>
        DateTimeOffset DueDate,
        int ProjectId,
        string ProjectName,
        string ColumnColor,
        bool IsCompleted,
        bool IsInbox,
        bool IsProjected
    );

    public static class CalendarWindow
    {
        /// <summary>
        /// The widest range one request may ask for. The window is the only bound on this
        /// endpoint's work — it is what replaces the row cap the dashboard's list uses — so
        /// without a ceiling a client could ask for a century of a daily series.
        /// </summary>
        public static int MaxDays => 366;

        /// <summary>
        /// How many occurrences a single rule may contribute. A daily task over a year is 365
        /// items from one row; past a point the answer to "what does this month hold" stops
        /// depending on drawing every one of them.
        /// </summary>
        public static int MaxProjectedPerTask => 200;
    }
}
