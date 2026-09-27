using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Scheduling;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Attachments
{
    /// <summary>
    /// Deletes files that nothing points at any more.
    /// <para>
    /// <b>This job exists because an attachment stopped having an owner.</b> Until L40.7 every
    /// file belonged to exactly one task, so "the task is gone" and "the file is gone" were the
    /// same event and each delete path could call <c>DeleteFileAsync</c> itself. The moment a
    /// project can hold a file and two tasks can reference it, every one of those calls is a
    /// data-loss bug: detaching from one task would delete the blob out from under the other.
    /// </para>
    /// <para>
    /// So no endpoint deletes a blob any more — which is the rule the codebase already had for
    /// soft deletes and now simply has everywhere. Detaching drops a join row; deciding whether
    /// the bytes may go is a question only a global view can answer, and this is it.
    /// </para>
    /// <para>
    /// Written as a query for outstanding work, like every other job here: it can miss a tick,
    /// run twice, or start on a container that has never seen the file, and the answer is the
    /// same each time.
    /// </para>
    /// </summary>
    public class AttachmentOrphanSweepJob(
        ApplicationDbContext dbContext,
        IFileService fileService,
        ILogger<AttachmentOrphanSweepJob> logger
    ) : IScheduledJob
    {
        public string Name => "attachment-orphan-sweep";

        // Disk is not urgent. Anything more frequent only narrows a window that nobody is
        // watching, at the cost of a scan.
        public TimeSpan Interval => TimeSpan.FromHours(6);

        /// <summary>
        /// How new a file has to be to survive having no references.
        /// <para>
        /// Not paranoia about the transaction — a file and its join row are written in one
        /// <c>SaveChanges</c>. It is about the gap <i>before</i> that: <c>UploadFileAsync</c>
        /// writes the bytes and adds the row, and a request that then fails validation leaves a
        /// legitimately unreferenced row for a moment. An hour means the sweep never races a
        /// request in flight, and costs nothing — the file was going to be deleted eventually
        /// either way.
        /// </para>
        /// </summary>
        public static TimeSpan GracePeriod => TimeSpan.FromHours(1);

        public async Task RunAsync(CancellationToken cancellationToken)
        {
            var cutoff = DateTime.UtcNow - GracePeriod;

            // IgnoreQueryFilters on both sides, and it is load-bearing in opposite directions.
            // A *trashed* task still references its files — a restore has to give back a task
            // whose attachments still open — so its joins must count, and the filter would hide
            // them and delete the files of everything in the trash. The project side is the same
            // story.
            var referencedByTasks = dbContext
                .Set<ProjectTaskAttachment>()
                .IgnoreQueryFilters()
                .Select(j => j.AttachmentId);

            var referencedByProjects = dbContext
                .Set<ProjectAttachment>()
                .IgnoreQueryFilters()
                .Select(j => j.AttachmentId);

            // A project image is a plain foreign key rather than a join, so it is a third kind of
            // reference and has to be named separately. Miss it and every project avatar is
            // deleted six hours after it is set.
            var usedAsProjectImage = dbContext
                .Projects.IgnoreQueryFilters()
                .Where(p => p.ImageId != null)
                .Select(p => p.ImageId!.Value);

            var orphanIds = await dbContext
                .Attachments.Where(a => a.CreatedAt < cutoff)
                .Where(a =>
                    !referencedByTasks.Contains(a.Id)
                    && !referencedByProjects.Contains(a.Id)
                    && !usedAsProjectImage.Contains(a.Id)
                )
                .Select(a => a.Id)
                .ToListAsync(cancellationToken);

            if (orphanIds.Count == 0)
                return;

            foreach (var id in orphanIds)
            {
                try
                {
                    // Deletes the blob and its row together. A failure here leaves both, and the
                    // next tick tries again — which is why nothing above marks progress.
                    await fileService.DeleteFileAsync(id, cancellationToken);
                }
                catch (Exception exception)
                {
                    // One unreadable file must not strand every other orphan behind it.
                    logger.LogError(exception, "Failed to delete orphaned attachment {Id}", id);
                }
            }

            logger.LogInformation("Swept {Count} orphaned attachments", orphanIds.Count);
        }
    }
}
