using System.Text.Json.Serialization;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    [JsonConverter(typeof(JsonStringEnumConverter<RecurrenceFrequency>))]
    public enum RecurrenceFrequency
    {
        DAILY,
        WEEKLY,
        MONTHLY,
        YEARLY,
    }

    /// <summary>
    /// "This comes back." Stored as a rule on the task, with only the <b>next</b> occurrence ever
    /// materialised — completing an instance writes the following one.
    /// <para>
    /// The alternative, computing instances on read, makes "show me next month" trivial and
    /// breaks everything else: an instance that exists only in a projection has no id, no score
    /// and no column, so it cannot be dragged, completed, assigned or reminded about, and every
    /// read path in the app would have to learn to invent them. Materialising one at a time means
    /// an instance is simply a task, and the board, the scores, the RBAC layer, reminders and
    /// L26's checklists all keep working with no idea recurrence exists.
    /// </para>
    /// </summary>
    public class TaskRecurrence
    {
        public int Id { get; set; }
        public int ProjectTaskId { get; set; }
        public RecurrenceFrequency Frequency { get; set; }

        /// <summary>How many periods between occurrences — 2 with WEEKLY is every other week.</summary>
        public int Interval { get; set; } = 1;

        /// <summary>
        /// Days of the week an occurrence falls on, as <see cref="DayOfWeek"/> values. Only read
        /// for <see cref="RecurrenceFrequency.WEEKLY"/>, where it is what makes "every Monday and
        /// Thursday" a single series rather than two tasks. Empty means "the same weekday as the
        /// current due date".
        /// </summary>
        public List<int> Weekdays { get; set; } = [];

        public ProjectTask ProjectTask { get; set; } = null!;

        /// <summary>
        /// Where the next occurrence falls, given the one that was just completed.
        /// <para>
        /// Anchored on the <b>previous due date</b>, not on when the task was actually ticked:
        /// "every Monday" has to stay on Mondays whether it is dealt with on the day or three
        /// days late, or a weekly obligation slowly walks through the week. The cost is that a
        /// series left alone for a month would generate a backlog of instances that are all
        /// already overdue, so <paramref name="notBefore"/> pulls the result forward: keep
        /// advancing until the occurrence is actually in the future. Missing four rent payments
        /// should leave one due next month, not four rows demanding attention for months that
        /// have already gone by.
        /// </para>
        /// </summary>
        public static DateTimeOffset NextDueDate(
            TaskRecurrence rule,
            DateTimeOffset previousDue,
            DateTimeOffset notBefore
        )
        {
            var next = Advance(rule, previousDue);

            // Bounded rather than `while (true)`: an interval of 0 would otherwise hang the
            // request thread outright. Validation rejects that, but this runs on data that is
            // already stored, and a busy loop is a far worse failure than a wrong date.
            for (var i = 0; next <= notBefore && i < MaxCatchUpSteps; i++)
                next = Advance(rule, next);

            return next;
        }

        // Roughly eleven years of a daily series — far past the point where catching up one
        // occurrence at a time is the right answer anyway.
        private const int MaxCatchUpSteps = 4000;

        private static DateTimeOffset Advance(TaskRecurrence rule, DateTimeOffset from)
        {
            var interval = Math.Max(1, rule.Interval);

            return rule.Frequency switch
            {
                RecurrenceFrequency.DAILY => from.AddDays(interval),
                RecurrenceFrequency.WEEKLY => AdvanceWeekly(rule, from, interval),
                // AddMonths clamps: the 31st of a month followed by a short one lands on the
                // 28th/30th rather than spilling into the next month. It does not climb back
                // afterwards, so a "last day of the month" series settles on the 28th — the
                // known cost of not storing an RRULE-style BYMONTHDAY=-1.
                RecurrenceFrequency.MONTHLY => from.AddMonths(interval),
                RecurrenceFrequency.YEARLY => from.AddYears(interval),
                _ => from.AddDays(interval),
            };
        }

        private static DateTimeOffset AdvanceWeekly(
            TaskRecurrence rule,
            DateTimeOffset from,
            int interval
        )
        {
            var days = rule.Weekdays.Select(d => (DayOfWeek)d).ToHashSet();
            if (days.Count == 0)
                return from.AddDays(7 * interval);

            // Walk to the next selected weekday. If that stays inside the same week the interval
            // does not apply — "every other Monday and Thursday" still means both days of the
            // weeks it runs in, not one day every other week.
            for (var i = 1; i <= 7; i++)
            {
                var candidate = from.AddDays(i);
                if (!days.Contains(candidate.DayOfWeek))
                    continue;

                return StartOfWeek(candidate) == StartOfWeek(from)
                    ? candidate
                    : candidate.AddDays(7 * (interval - 1));
            }

            return from.AddDays(7 * interval);
        }

        /// <summary>Monday-based, so a Sunday belongs to the week that just ended rather than starting one.</summary>
        private static DateTimeOffset StartOfWeek(DateTimeOffset date) =>
            date.Date.AddDays(-(((int)date.DayOfWeek + 6) % 7));
    }

    /// <summary>
    /// A recurrence as submitted on a task's create/update request. Null on the request means the
    /// task does not repeat — and on an update, that any rule it had is removed.
    /// </summary>
    public record RecurrenceInput
    {
        public RecurrenceFrequency Frequency { get; set; }
        public int Interval { get; set; } = 1;
        public List<int>? Weekdays { get; set; } = [];
    }

    public record RecurrenceDetails(
        RecurrenceFrequency Frequency,
        int Interval,
        List<int> Weekdays
    );
}
