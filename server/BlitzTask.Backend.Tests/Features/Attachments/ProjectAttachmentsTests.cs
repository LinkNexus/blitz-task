using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Attachments;

/// <summary>
/// Project-level files, and the lifecycle change underneath them.
/// <para>
/// Until L40.7 an attachment had exactly one owner, so every delete path deleted its blob. The
/// moment two things can point at one file, each of those calls is a way to lose somebody else's
/// data — so most of what is tested here is the <b>absence</b> of a delete, and the one job that
/// is now allowed to perform one.
/// </para>
/// </summary>
public class ProjectAttachmentsTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static Attachment NewAttachment(int uploaderId, string name = "spec.pdf") =>
        new()
        {
            Id = Guid.NewGuid(),
            OriginalFilename = name,
            StoredFilename = Path.GetFileNameWithoutExtension(name),
            Extension = Path.GetExtension(name),
            ContentType = "application/pdf",
            SizeInBytes = 1024,
            StorageDirectory = "attachments",
            UploadedByUserId = uploaderId,
        };

    /// <summary>
    /// Adds a file to the project directly. The upload endpoint needs an <c>IFormFile</c> and a
    /// real <c>IFileService</c>; what the tests below are about is what happens to a file that
    /// already exists.
    /// </summary>
    private static async Task<Attachment> SeedProjectFileAsync(
        ApplicationDbContext dbContext,
        Project project,
        User uploader,
        string name = "spec.pdf"
    )
    {
        var attachment = NewAttachment(uploader.Id, name);
        // Added explicitly rather than through the navigation: Attachment.Id self-initialises, so
        // EF reads a bare navigation add as an existing row and issues an UPDATE.
        dbContext.Attachments.Add(attachment);
        dbContext
            .Set<ProjectAttachment>()
            .Add(new ProjectAttachment { ProjectId = project.Id, AttachmentId = attachment.Id });
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();
        return attachment;
    }

    private static AttachmentOrphanSweepJob SweepWith(
        ApplicationDbContext dbContext,
        Mock<IFileService> files
    ) => new(dbContext, files.Object, NullLogger<AttachmentOrphanSweepJob>.Instance);

    private static Mock<IFileService> FileService()
    {
        var files = new Mock<IFileService>();
        files
            .Setup(f => f.DeleteFileAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        return files;
    }

    /// <summary>Backdates a file past the sweep's grace period.</summary>
    private static async Task AgeAsync(ApplicationDbContext dbContext, params Guid[] ids)
    {
        var old = DateTime.UtcNow - AttachmentOrphanSweepJob.GracePeriod - TimeSpan.FromHours(1);
        await dbContext
            .Attachments.Where(a => ids.Contains(a.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.CreatedAt, old));
        dbContext.ChangeTracker.Clear();
    }

    [Fact]
    public async Task TheProjectListsItsFilesWithHowManyTasksUseThem()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var spec = await SeedProjectFileAsync(dbContext, project, alice);
        await SeedProjectFileAsync(dbContext, project, alice, "unused.pdf");

        var one = await SeedTaskAsync(dbContext, project, todo, "Build it");
        var two = await SeedTaskAsync(dbContext, project, todo, "Review it");
        foreach (var task in new[] { one, two })
        {
            dbContext
                .Set<ProjectTaskAttachment>()
                .Add(new ProjectTaskAttachment { ProjectTaskId = task.Id, AttachmentId = spec.Id });
        }
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();

        var result = await ProjectAttachmentsEndpoints.ListProjectAttachments(
            project.Id,
            dbContext,
            CancellationToken.None
        );

        var files = Assert.IsType<Ok<List<ProjectAttachmentDetails>>>(result).Value!;

        // The count is what tells someone whether removing the file strands anything.
        Assert.Equal(2, files.Single(f => f.Id == spec.Id).ReferencedByTaskCount);
        Assert.Equal(0, files.Single(f => f.OriginalFileName == "unused.pdf").ReferencedByTaskCount);
    }

    [Fact]
    public async Task ATaskMayOnlyReferenceAFileTheProjectHolds()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (mine, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var (theirs, _, _) = await SeedProjectAsync(dbContext, "Beta", bob.Id);

        var stranger = await SeedProjectFileAsync(dbContext, theirs, bob, "private.pdf");
        var task = await SeedTaskAsync(dbContext, mine, todo, "Build it");

        var result = await ProjectAttachmentsEndpoints.ReferenceAttachmentFromTask(
            mine.Id,
            task.Id,
            stranger.Id,
            dbContext,
            CancellationToken.None
        );

        // Not merely tidiness. The download endpoint authorises by "is this file reachable from
        // the project", so attaching someone else's file would be enough to read it.
        Assert.IsType<NotFound<ApiMessageResponse>>(result.Result);
        Assert.Empty(await dbContext.Set<ProjectTaskAttachment>().ToListAsync());
    }

    [Fact]
    public async Task ReferencingTwiceIsNotAnError()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var spec = await SeedProjectFileAsync(dbContext, project, alice);
        var task = await SeedTaskAsync(dbContext, project, todo, "Build it");

        for (var i = 0; i < 2; i++)
        {
            var result = await ProjectAttachmentsEndpoints.ReferenceAttachmentFromTask(
                project.Id,
                task.Id,
                spec.Id,
                dbContext,
                CancellationToken.None
            );
            Assert.IsType<NoContent>(result.Result);
            dbContext.ChangeTracker.Clear();
        }

        // A double click must not trip the composite primary key.
        Assert.Single(await dbContext.Set<ProjectTaskAttachment>().ToListAsync());
    }

    [Fact]
    public async Task TakingAFileOffTheProjectLeavesTheTasksThatUseIt()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var spec = await SeedProjectFileAsync(dbContext, project, alice);
        var task = await SeedTaskAsync(dbContext, project, todo, "Build it");

        await ProjectAttachmentsEndpoints.ReferenceAttachmentFromTask(
            project.Id,
            task.Id,
            spec.Id,
            dbContext,
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        var result = await ProjectAttachmentsEndpoints.RemoveProjectAttachment(
            project.Id,
            spec.Id,
            dbContext,
            CancellationToken.None
        );

        Assert.IsType<NoContent>(result.Result);
        Assert.Empty(await dbContext.Set<ProjectAttachment>().ToListAsync());
        // This is the property that makes the button safe to press — and the reason it is gated
        // no higher than uploading.
        Assert.Single(await dbContext.Set<ProjectTaskAttachment>().ToListAsync());
        Assert.NotNull(await dbContext.Attachments.FindAsync(spec.Id));
    }

    [Fact]
    public async Task DetachingFromOneTaskDoesNotTakeTheFileFromAnother()
    {
        // The bug L40.7 existed to avoid, and the reason no endpoint deletes a blob any more.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var spec = await SeedProjectFileAsync(dbContext, project, alice);

        var one = await SeedTaskAsync(dbContext, project, todo, "Build it");
        var two = await SeedTaskAsync(dbContext, project, todo, "Review it");
        foreach (var task in new[] { one, two })
        {
            await ProjectAttachmentsEndpoints.ReferenceAttachmentFromTask(
                project.Id,
                task.Id,
                spec.Id,
                dbContext,
                CancellationToken.None
            );
            dbContext.ChangeTracker.Clear();
        }

        await ProjectAttachmentsEndpoints.DereferenceAttachmentFromTask(
            project.Id,
            one.Id,
            spec.Id,
            dbContext,
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        Assert.NotNull(await dbContext.Attachments.FindAsync(spec.Id));
        var remaining = Assert.Single(await dbContext.Set<ProjectTaskAttachment>().ToListAsync());
        Assert.Equal(two.Id, remaining.ProjectTaskId);
    }

    [Fact]
    public async Task TheSweepDeletesAFileNothingPointsAt()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var spec = await SeedProjectFileAsync(dbContext, project, alice);

        await dbContext
            .Set<ProjectAttachment>()
            .Where(j => j.AttachmentId == spec.Id)
            .ExecuteDeleteAsync();
        await AgeAsync(dbContext, spec.Id);

        var files = FileService();
        await SweepWith(dbContext, files).RunAsync(CancellationToken.None);

        files.Verify(f => f.DeleteFileAsync(spec.Id, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task TheSweepSparesAFileInsideItsGracePeriod()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var spec = await SeedProjectFileAsync(dbContext, project, alice);

        await dbContext
            .Set<ProjectAttachment>()
            .Where(j => j.AttachmentId == spec.Id)
            .ExecuteDeleteAsync();

        var files = FileService();
        await SweepWith(dbContext, files).RunAsync(CancellationToken.None);

        // Uploading writes the bytes and the row before anything references them; without the
        // grace period a sweep could land inside a request that has not saved yet.
        files.Verify(
            f => f.DeleteFileAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never
        );
    }

    [Theory]
    [InlineData("project")]
    [InlineData("task")]
    [InlineData("trashed task")]
    [InlineData("project image")]
    public async Task TheSweepSparesAnythingStillReferenced(string holder)
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var attachment = NewAttachment(alice.Id);
        dbContext.Attachments.Add(attachment);
        await dbContext.SaveChangesAsync();

        switch (holder)
        {
            case "project":
                dbContext
                    .Set<ProjectAttachment>()
                    .Add(
                        new ProjectAttachment
                        {
                            ProjectId = project.Id,
                            AttachmentId = attachment.Id,
                        }
                    );
                break;

            case "task":
            case "trashed task":
                var task = await SeedTaskAsync(dbContext, project, todo, "Build it");
                dbContext
                    .Set<ProjectTaskAttachment>()
                    .Add(
                        new ProjectTaskAttachment
                        {
                            ProjectTaskId = task.Id,
                            AttachmentId = attachment.Id,
                        }
                    );
                // A trashed task is still restorable, and a restore has to give back a task whose
                // attachments still open — so the sweep must look past the soft-delete filter.
                if (holder == "trashed task")
                    task.DeletedAt = DateTime.UtcNow;
                break;

            case "project image":
                // A third kind of reference: a plain foreign key rather than a join. Miss it and
                // every project avatar disappears six hours after it is set.
                project.ImageId = attachment.Id;
                break;
        }

        await dbContext.SaveChangesAsync();
        await AgeAsync(dbContext, attachment.Id);

        var files = FileService();
        await SweepWith(dbContext, files).RunAsync(CancellationToken.None);

        files.Verify(
            f => f.DeleteFileAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never
        );
    }

    [Fact]
    public async Task AProjectFileNoTaskUsesIsStillDownloadable()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var spec = await SeedProjectFileAsync(dbContext, project, alice);

        var files = new Mock<IFileService>();
        files
            .Setup(f => f.GetFileAsync(spec.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
                new FileDownloadResult(new MemoryStream([1, 2, 3]), "spec.pdf", "application/pdf")
            );

        var result = await ProjectsEndpoints.AccessAttachment(
            project.Id,
            spec.Id,
            dbContext,
            ContextFor(alice),
            files.Object,
            CancellationToken.None
        );

        // Authorisation rebuilds the allowed set from the project's references. Before L40.7 it
        // knew about the image and task attachments only, so a file attached to the project and
        // to nothing else was unreachable by design.
        Assert.IsType<FileStreamHttpResult>(result.Result);
    }
}
