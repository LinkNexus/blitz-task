using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Projects;

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
        /// <summary>
        /// Whether the time of day on the dates above was chosen by a person. A grid that draws
        /// everything at midnight is drawing a default, not a fact — and the ICS feed uses these
        /// to decide between an all-day event and a timed one.
        /// </summary>
        bool HasStartTime,
        bool HasDueTime,
        int ProjectId,
        string ProjectName,
        /// <summary>
        /// The owning project's accent, so a row in a list that mixes projects can be marked as
        /// belonging to one. Denormalised beside the name for the same reason the name is: the
        /// alternative is the client holding a project lookup for screens that never load a
        /// project. See <see cref="Projects.ProjectAccent"/> — it is a mark, never ink.
        /// </summary>
        ProjectAccent Accent,
        string ColumnColor,
        bool IsCompleted,
        bool IsInbox,
        bool IsProjected,
        /// <summary>
        /// Whether the caller may drag this to another day. Seeing an item is not being allowed
        /// to move it — the calendar shows every project the caller is in, including ones they
        /// only have read access to, and a bar that moves and then snaps back is worse than one
        /// that never offered. Always false for a projected occurrence, which has no row to
        /// write a new date onto.
        /// </summary>
        bool CanReschedule
    );

    /// <summary>
    /// A person's calendar subscription, or the absence of one.
    /// <para>
    /// Returns the whole URL rather than the bare token because the token is only useful inside
    /// it, and building the origin is <see cref="Shared.Services.AppUrlBuilder"/>'s job — a
    /// client that assembled it from <c>window.location</c> would be wrong behind a proxy and
    /// wrong in an email.
    /// </para>
    /// </summary>
    public record CalendarFeedSubscription(string? Url);

    public static class CalendarFeed
    {
        /// <summary>
        /// How far back the feed reaches. Past deadlines are the record of what was due when, and
        /// a subscription that silently drops them rewrites the calendar behind you — but a year
        /// of them is noise, so it stops.
        /// </summary>
        public static int PastDays => 90;

        /// <summary>
        /// How far ahead. This is the horizon the roadmap warned about: occurrences are
        /// materialised rather than emitted as <c>RRULE</c>s, so a weekly chore stops here. A year
        /// is past the point where anyone is planning against a recurring task, and a client
        /// re-polls the feed long before reaching it.
        /// </summary>
        public static int FutureDays => 365;
    }

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
