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
        /// Files first, rows second. The other order loses the attachment ids: the rows carry the
        /// only record of which blobs belong to the task, and once they are gone the files are
        /// unreferenced bytes on a volume nothing will ever sweep.
        /// </summary>
        public static async Task PurgeTaskAsync(
            ProjectTask task,
            ApplicationDbContext dbContext,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            foreach (var attachment in task.Attachments.ToList())
                await fileService.DeleteFileAsync(attachment.Id, cancellationToken);

            dbContext.ProjectTasks.Remove(task);
        }

        public static async Task PurgeProjectAsync(
            Projects.Project project,
            ApplicationDbContext dbContext,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            if (project.ImageId.HasValue)
                await fileService.DeleteFileAsync(project.ImageId.Value, cancellationToken);

            // Loaded past the query filter on purpose: by now every task under this project is
            // trashed, so the filtered navigation would be empty and their files would survive
            // the project that owned them.
            var attachmentIds = await dbContext
                .ProjectTasks.IgnoreQueryFilters()
                .Where(t => t.RelatedProjectId == project.Id)
                .SelectMany(t => t.Attachments.Select(a => a.Id))
                .ToListAsync(cancellationToken);

            foreach (var attachmentId in attachmentIds)
                await fileService.DeleteFileAsync(attachmentId, cancellationToken);

            // Columns and tasks go with it through the FK cascade.
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
