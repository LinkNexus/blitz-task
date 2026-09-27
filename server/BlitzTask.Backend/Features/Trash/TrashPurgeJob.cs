using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Scheduling;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Trash
{
    /// <summary>
    /// The one place a project or a task is actually destroyed, and therefore the one place
    /// anything is removed from disk. Every delete endpoint now only stamps
    /// <c>DeletedAt</c> — if files were deleted there, a restore would hand back a project whose
    /// attachments 404.
    /// </summary>
    public static class TrashPurge
    {
        /// <summary>
        /// Removes the task. Its files are <b>not</b> deleted here.
        /// <para>
        /// This used to delete them, in this order, precisely because the rows were the only
        /// record of which blobs belonged to the task. Since L40.7 they are not: a file can also
        /// be the project's, or referenced by another task, so "the last task holding it is
        /// purged" no longer means "nobody wants it". Dropping the rows is what makes it an
        /// orphan, and <c>AttachmentOrphanSweepJob</c> is what notices — including for anything
        /// this job orphaned on a previous run and a crash left behind.
        /// </para>
        /// </summary>
        public static Task PurgeTaskAsync(
            ProjectTask task,
            ApplicationDbContext dbContext,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            dbContext.ProjectTasks.Remove(task);
            return Task.CompletedTask;
        }

        public static async Task PurgeProjectAsync(
            Projects.Project project,
            ApplicationDbContext dbContext,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            // Same as above: removing the project drops its image reference, its own attachment
            // joins and — through the FK cascade — every task's, which is exactly what turns
            // those files into orphans for the sweep to collect. It no longer walks the tasks
            // past the query filter to find blobs, because finding them is not the question any
            // more; whether anything *else* still points at them is, and one project cannot see
            // that.
            dbContext.Projects.Remove(project);
        }
    }

    /// <summary>
    /// Empties the trash of anything past <see cref="TrashRetention.Window"/>.
    /// <para>
    /// Written as a query for outstanding work rather than a schedule it tries to keep, as every
    /// job here must be: the container is replaced on each deploy, so this cannot assume it ran
    /// yesterday. Asking "what is older than the window" is correct however long it was away.
    /// </para>
    /// </summary>
    public class TrashPurgeJob(
        ApplicationDbContext dbContext,
        IFileService fileService,
        ILogger<TrashPurgeJob> logger
    ) : IScheduledJob
    {
        public string Name => nameof(TrashPurgeJob);

        // Hourly. The window is measured in weeks, so the exact minute a row dies does not
        // matter, and a sweep every minute would be a table scan for nothing.
        public TimeSpan Interval => TimeSpan.FromHours(1);

        public async Task RunAsync(CancellationToken cancellationToken)
        {
            var cutoff = DateTime.UtcNow - TrashRetention.Window;

            var projects = await dbContext
                .Projects.IgnoreQueryFilters()
                .Where(p => p.DeletedAt != null && p.DeletedAt < cutoff)
                .ToListAsync(cancellationToken);

            foreach (var project in projects)
                await TrashPurge.PurgeProjectAsync(project, dbContext, fileService, cancellationToken);

            // Tasks whose project is being purged in this same pass are skipped: the cascade
            // takes them, and removing them here first would only be a second way to say so.
            var purgedProjectIds = projects.Select(p => p.Id).ToHashSet();

            var tasks = await dbContext
                .ProjectTasks.IgnoreQueryFilters()
                .Include(t => t.Attachments)
                .Where(t => t.DeletedAt != null && t.DeletedAt < cutoff)
                .ToListAsync(cancellationToken);

            foreach (var task in tasks.Where(t => !purgedProjectIds.Contains(t.RelatedProjectId)))
                await TrashPurge.PurgeTaskAsync(task, dbContext, fileService, cancellationToken);

            // A column left behind by its project surviving — its tasks are already gone above.
            var columns = await dbContext
                .ProjectColumns.IgnoreQueryFilters()
                .Where(c => c.DeletedAt != null && c.DeletedAt < cutoff)
                .Where(c => !purgedProjectIds.Contains(c.ProjectId))
                .ToListAsync(cancellationToken);

            dbContext.ProjectColumns.RemoveRange(columns);

            if (projects.Count == 0 && tasks.Count == 0 && columns.Count == 0)
                return;

            await dbContext.SaveChangesAsync(cancellationToken);

            logger.LogInformation(
                "Purged {Projects} project(s), {Tasks} task(s) and {Columns} column(s) from the trash",
                projects.Count,
                tasks.Count,
                columns.Count
            );
        }
    }
}
