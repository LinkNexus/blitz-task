using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Features.Trash;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Trash;

/// <summary>
/// Soft delete and the trash. Two ideas carry the whole feature.
/// <para>
/// <b>A global query filter</b> means every existing query excludes trashed rows without being
/// rewritten, so the tests that matter most are the ones asserting a deleted thing is invisible
/// to code that has never heard of the trash.
/// </para>
/// <para>
/// <b>A cascade stamps one instant</b> across a parent and its children, and that shared value is
/// what a restore matches on — which is how something thrown away deliberately last week stays
/// thrown away when the project above it comes back.
/// </para>
/// </summary>
public class TrashTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static Task<ProjectTask?> RawTask(ApplicationDbContext dbContext, int taskId) =>
        dbContext.ProjectTasks.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == taskId);

    [Fact]
    public async Task DeletingATaskHidesItEverywhereWithoutDestroyingIt()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await ProjectTasksEndpoints.DeleteTask(
            project.Id,
            task.Id,
            dbContext,
            CancellationToken.None
        );

        dbContext.ChangeTracker.Clear();

        // Invisible to a query that knows nothing about the trash — including the board's own.
        Assert.Empty(await dbContext.ProjectTasks.ToListAsync());

        var details = await dbContext
            .Projects.Where(p => p.Id == project.Id)
            .SelectProjectDetails()
            .FirstAsync();
        Assert.Empty(details.Columns.SelectMany(c => c.Tasks));

        // But still there, and still recoverable.
        var raw = await RawTask(dbContext, task.Id);
        Assert.NotNull(raw);
        Assert.NotNull(raw!.DeletedAt);
    }

    [Fact]
    public async Task DeletingATaskLeavesItsFilesAlone()
    {
        // The whole reason files are not touched until the purge: a restore has to give back a
        // task whose attachments still open.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        var files = new Mock<IFileService>();

        await ProjectTasksEndpoints.DeleteTask(
            project.Id,
            task.Id,
            dbContext,
            CancellationToken.None
        );

        files.Verify(
            f => f.DeleteFileAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never
        );
    }

    [Fact]
    public async Task RestoringAProjectBringsBackOnlyWhatCameDownWithIt()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var kept = await SeedTaskAsync(dbContext, project, todo, "Comes back");
        var thrownAwayEarlier = await SeedTaskAsync(dbContext, project, todo, "Stays gone");

        await ProjectTasksEndpoints.DeleteTask(
            project.Id,
            thrownAwayEarlier.Id,
            dbContext,
            CancellationToken.None
        );

        await ProjectsEndpoints.DeleteProject(project.Id, dbContext, CancellationToken.None);
        dbContext.ChangeTracker.Clear();

        await TrashEndpoints.RestoreProject(
            project.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        // The project and its board are back...
        Assert.NotNull(await dbContext.Projects.FirstOrDefaultAsync(p => p.Id == project.Id));
        Assert.Equal(2, await dbContext.ProjectColumns.CountAsync());

        // ...along with the task that only went down because the project did. The one the user
        // deliberately threw away first is still in the trash, where they put it.
        var live = await dbContext.ProjectTasks.Select(t => t.Name).ToListAsync();
        Assert.Equal(["Comes back"], live);
        Assert.NotNull((await RawTask(dbContext, thrownAwayEarlier.Id))!.DeletedAt);
    }

    [Fact]
    public async Task DeletingAColumnTrashesItsTasksRatherThanDestroyingThem()
    {
        // The column has to be trashed too: the tasks' FK cascades, so hard-deleting it would
        // take them with it however carefully they were stamped.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await ProjectColumnsEndpoints.DeleteColumn(
            project.Id,
            todo.Id,
            dbContext,
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        Assert.Single(await dbContext.ProjectColumns.ToListAsync());
        Assert.NotNull((await RawTask(dbContext, task.Id))!.DeletedAt);
    }

    [Fact]
    public async Task RestoringATaskWhoseColumnIsGoneLandsItInTheFirstLiveColumn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await ProjectColumnsEndpoints.DeleteColumn(
            project.Id,
            todo.Id,
            dbContext,
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        await TrashEndpoints.RestoreTask(
            task.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        // Dragging the discarded column back would undo a decision the user made on purpose, so
        // the task goes where a task with no stated column always goes.
        var restored = await dbContext.ProjectTasks.SingleAsync();
        Assert.Equal(done.Id, restored.RelatedColumnId);
    }

    [Fact]
    public async Task ATaskCannotBeRestoredWhileItsProjectIsStillInTheTrash()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await ProjectsEndpoints.DeleteProject(project.Id, dbContext, CancellationToken.None);
        dbContext.ChangeTracker.Clear();

        var result = await TrashEndpoints.RestoreTask(
            task.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.IsType<BadRequest<ApiMessageResponse>>(result);
        Assert.NotNull((await RawTask(dbContext, task.Id))!.DeletedAt);
    }

    [Fact]
    public async Task TheTrashListsWhatIsRecoverableAndSaysWhoMayRecoverIt()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var viewer = await TestsUtils.SeedUserAsync(dbContext, "viewer@example.com");
        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (viewer.Id, ProjectRole.Viewer)
        );
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await ProjectTasksEndpoints.DeleteTask(
            project.Id,
            task.Id,
            dbContext,
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        var owned = await TrashEndpoints.ListTrash(
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var item = Assert.Single(owned.Value!);
        Assert.Equal(TrashItemKind.TASK, item.Kind);
        Assert.Equal("Ship it", item.Name);
        Assert.Equal("Alpha", item.ProjectName);
        Assert.True(item.CanRestore);
        Assert.Equal(TrashRetention.PurgeAt(item.DeletedAt), item.PurgeAt);

        // A Viewer sees the same row — the trash is a property of the work, not of who clicked
        // delete — but is told they cannot act on it.
        var seenByViewer = await TrashEndpoints.ListTrash(
            dbContext,
            ContextFor(viewer),
            CancellationToken.None
        );
        Assert.False(Assert.Single(seenByViewer.Value!).CanRestore);
    }

    [Fact]
    public async Task TasksThatComeBackWithTheirProjectAreNotListedSeparately()
    {
        // Listing them would offer a restore that cannot work on its own — the task's project is
        // in the trash too, so restoring it alone is refused.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await ProjectsEndpoints.DeleteProject(project.Id, dbContext, CancellationToken.None);
        dbContext.ChangeTracker.Clear();

        var listed = await TrashEndpoints.ListTrash(
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var item = Assert.Single(listed.Value!);
        Assert.Equal(TrashItemKind.PROJECT, item.Kind);
        Assert.Equal(1, item.TaskCount);
    }

    [Fact]
    public async Task AProjectYouAreNotInIsNotFoundRatherThanForbidden()
    {
        // Same rule as RequireProjectPermissionFilter: the endpoint must not be usable to
        // discover which project ids exist.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var stranger = await TestsUtils.SeedUserAsync(dbContext, "stranger@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        await ProjectsEndpoints.DeleteProject(project.Id, dbContext, CancellationToken.None);
        dbContext.ChangeTracker.Clear();

        var result = await TrashEndpoints.RestoreProject(
            project.Id,
            dbContext,
            ContextFor(stranger),
            CancellationToken.None
        );

        Assert.IsType<NotFound<ApiMessageResponse>>(result);
    }

    [Fact]
    public async Task ThePurgeTakesWhatIsPastTheWindowAndItsFilesWithIt()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var old = await SeedTaskAsync(dbContext, project, todo, "Long gone");
        var recent = await SeedTaskAsync(dbContext, project, todo, "Just deleted");

        var attachment = new Attachment
        {
            Id = Guid.NewGuid(),
            OriginalFilename = "notes.pdf",
            StoredFilename = "notes",
            Extension = ".pdf",
            ContentType = "application/pdf",
            SizeInBytes = 10,
            StorageDirectory = "attachments",
            UploadedByUserId = alice.Id,
        };
        // Added explicitly: Attachment.Id self-initializes to a fresh Guid, so a bare
        // navigation add leaves EF reading it as an existing row and issuing an UPDATE.
        dbContext.Attachments.Add(attachment);
        old.Attachments.Add(attachment);

        old.DeletedAt = DateTime.UtcNow - TrashRetention.Window - TimeSpan.FromDays(1);
        recent.DeletedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();

        var files = new Mock<IFileService>();
        files
            .Setup(f => f.DeleteFileAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var job = new TrashPurgeJob(dbContext, files.Object, NullLogger<TrashPurgeJob>.Instance);
        await job.RunAsync(CancellationToken.None);
        dbContext.ChangeTracker.Clear();

        Assert.Null(await RawTask(dbContext, old.Id));
        // Still inside its window, so still recoverable.
        Assert.NotNull(await RawTask(dbContext, recent.Id));

        // The purge is the only thing that touches disk, and it has to, or the volume fills with
        // blobs nothing references.
        files.Verify(f => f.DeleteFileAsync(attachment.Id, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ThePurgeIsQuietAndHarmlessWhenTheTrashIsEmpty()
    {
        // It runs every hour forever; the common case has to cost nothing and change nothing.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, todo, "Ship it");

        var files = new Mock<IFileService>(MockBehavior.Strict);
        var job = new TrashPurgeJob(dbContext, files.Object, NullLogger<TrashPurgeJob>.Instance);

        await job.RunAsync(CancellationToken.None);

        Assert.Single(await dbContext.ProjectTasks.ToListAsync());
    }
}
