using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Infrastructure.Data;

namespace BlitzTask.Backend.Features.Activity
{
    /// <summary>
    /// How a handler says what just happened.
    /// <para>
    /// <b>Adds, never saves.</b> The event joins whatever <c>SaveChanges</c> the handler was
    /// already going to make, so the record and the thing it records commit together or not at
    /// all — the same reason L25's recurrence spawn shares the move's save. A recorder with its
    /// own save would leave a feed claiming a task was moved by a request that then failed.
    /// </para>
    /// <para>
    /// Deliberately not an interface with a DI registration. There is nothing to swap and
    /// nothing to mock: a test asserts on the rows, which is the behaviour anyone cares about.
    /// </para>
    /// </summary>
    public static class ActivityRecorder
    {
        /// <summary>
        /// Records something done to a task.
        /// <para>
        /// Takes the <b>entity</b> rather than an id, which is what lets a creation be recorded
        /// in the same save as the task it describes: a task being inserted has no id yet, and
        /// setting the navigation lets EF fix the foreign key up itself. The name comes off the
        /// same object, so no caller has to remember to denormalise it.
        /// </para>
        /// </summary>
        public static ActivityEvent RecordTask(
            ApplicationDbContext dbContext,
            User actor,
            ProjectTask task,
            ActivityKind kind,
            string? fromLabel = null,
            string? toLabel = null
        )
        {
            var entry = New(actor, task.RelatedProjectId, kind, task.Name, fromLabel, toLabel);
            entry.Task = task;
            dbContext.ActivityEvents.Add(entry);
            return entry;
        }

        /// <summary>
        /// Records something done to the project itself — a member joining, leaving or changing
        /// role. No task, so <see cref="ActivityEvent.Subject"/> carries the person instead.
        /// </summary>
        public static ActivityEvent RecordProject(
            ApplicationDbContext dbContext,
            User actor,
            int projectId,
            ActivityKind kind,
            string? subject = null,
            string? fromLabel = null,
            string? toLabel = null
        )
        {
            var entry = New(actor, projectId, kind, subject, fromLabel, toLabel);
            dbContext.ActivityEvents.Add(entry);
            return entry;
        }

        private static ActivityEvent New(
            User actor,
            int projectId,
            ActivityKind kind,
            string? subject,
            string? fromLabel,
            string? toLabel
        ) =>
            new()
            {
                ProjectId = projectId,
                ActorId = actor.Id,
                ActorName = actor.Name,
                Kind = kind,
                Subject = subject,
                FromLabel = fromLabel,
                ToLabel = toLabel,
            };
    }
}
