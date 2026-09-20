using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Infrastructure.Data;

namespace BlitzTask.Backend.Features.Notifications
{
    /// <summary>
    /// Fans one act out to the people it concerns.
    /// <para>
    /// Adds and never saves, exactly like L31's <c>ActivityRecorder</c>: the rows join the
    /// handler's own <c>SaveChanges</c>, so a request that fails cannot leave someone told about
    /// something that did not happen.
    /// </para>
    /// </summary>
    public static class NotificationRecorder
    {
        /// <summary>
        /// Tells <paramref name="recipients"/> about something done to a task.
        /// <para>
        /// <b>The actor never notifies themselves.</b> Filtered here rather than at each call
        /// site, because it is the rule that decides whether the bell is worth looking at: a
        /// count that goes up when you assign yourself a task, or comment on your own, is an
        /// echo, and a user learns to ignore it in about a day.
        /// </para>
        /// <para>
        /// Duplicates within one call are collapsed too — an assignee who also commented earlier
        /// is one person, and would otherwise be told twice about the same remark.
        /// </para>
        /// </summary>
        public static void NotifyAboutTask(
            ApplicationDbContext dbContext,
            User actor,
            ProjectTask task,
            NotificationKind kind,
            IEnumerable<int> recipients,
            TaskComments.TaskComment? comment = null
        )
        {
            foreach (var userId in recipients.Where(id => id != actor.Id).Distinct())
            {
                dbContext.Notifications.Add(
                    new Notification
                    {
                        UserId = userId,
                        Kind = kind,
                        ActorId = actor.Id,
                        ActorName = actor.Name,
                        ProjectId = task.RelatedProjectId,
                        Task = task,
                        TaskName = task.Name,
                        // Passed as the entity rather than an id for the same reason L31's
                        // recorder takes one: a comment being inserted has no id until the save
                        // this event shares, and the navigation lets EF fix the key up.
                        Comment = comment,
                    }
                );
            }
        }
    }
}
