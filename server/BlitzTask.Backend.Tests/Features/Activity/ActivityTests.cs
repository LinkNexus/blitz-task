using BlitzTask.Backend.Features.Activity;
using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Moq;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Activity;

/// <summary>
/// The activity log. What is worth pinning is not that rows appear — it is <b>which</b> moves
/// count as news, that the labels survive the things they describe, and that recording shares
/// the handler's own save.
/// </summary>
public class ActivityTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static Task<Ok<List<ActivityEntry>>> FeedAsync(
        ApplicationDbContext dbContext,
        int projectId,
        int limit = ActivityFeed.DefaultPageSize
    ) => ActivityEndpoints.ListActivity(projectId, dbContext, CancellationToken.None, limit);

    private static async Task<List<ActivityEntry>> EntriesAsync(
        ApplicationDbContext dbContext,
        int projectId
    ) => (await FeedAsync(dbContext, projectId)).Value!;

    private static Task MoveAsync(
        ApplicationDbContext dbContext,
        User user,
        int projectId,
        int taskId,
        int columnId,
        float score = 2000f
    ) =>
        ProjectTasksEndpoints.MoveTask(
            projectId,
            taskId,
            new MoveProjectTaskRequest(columnId, score),
            dbContext,
            ContextFor(user),
            CancellationToken.None
        );

    [Fact]
    public async Task AMoveIntoTheLastColumnIsCompletion_NotJustAMove()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await MoveAsync(dbContext, alice, project.Id, task.Id, done.Id);

        var entry = Assert.Single(await EntriesAsync(dbContext, project.Id));

        // Completion is a *position* here, so only the handler knows this move finished the work.
        // A feed row carrying just "moved" would leave the reader to work that out from column
        // names they cannot see the ordering of.
        Assert.Equal(ActivityKind.TASK_COMPLETED, entry.Kind);
        Assert.Equal("Ship it", entry.Subject);
        Assert.Equal("Todo", entry.FromLabel);
        Assert.Equal("Done", entry.ToLabel);
        Assert.Equal(alice.Name, entry.ActorName);
    }

    [Fact]
    public async Task ReorderingWithinAColumnIsNotNews()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        // Same column, new score — a nudge up or down a list. Recording these would bury every
        // move that means something under the ones that do not.
        await MoveAsync(dbContext, alice, project.Id, task.Id, todo.Id, 5000f);

        Assert.Empty(await EntriesAsync(dbContext, project.Id));
    }

    [Fact]
    public async Task ATaskCreationIsRecordedInTheSameSaveAsTheTask()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var created = await ProjectTasksEndpoints.CreateTask(
            project.Id,
            todo.Id,
            new CreateProjectTaskRequest { Name = "Fresh", Description = "" },
            dbContext,
            ContextFor(alice),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

        var task = Assert.IsType<JsonHttpResult<ProjectTaskDetails>>(created.Result).Value!;
        var entry = Assert.Single(await EntriesAsync(dbContext, project.Id));

        // The task has no id until the insert, so the event hangs off the *navigation* and lets
        // EF fix the key up — which is what keeps it in one save rather than two.
        Assert.Equal(ActivityKind.TASK_CREATED, entry.Kind);
        Assert.Equal(task.Id, entry.TaskId);
        Assert.Equal("Fresh", entry.Subject);
    }

    [Fact]
    public async Task HistorySurvivesTheTaskItDescribes()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await MoveAsync(dbContext, alice, project.Id, task.Id, done.Id);

        // Past the trash window the purge hard-deletes the row. "Who finished this" is asked
        // precisely when the thing is gone, so the entry is orphaned rather than cascaded.
        dbContext.ProjectTasks.Remove(
            await dbContext.ProjectTasks.IgnoreQueryFilters().SingleAsync(t => t.Id == task.Id)
        );
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();

        var entry = Assert.Single(await EntriesAsync(dbContext, project.Id));

        Assert.Null(entry.TaskId);
        // Still readable, because nothing here was ever an id waiting to be resolved.
        Assert.Equal("Ship it", entry.Subject);
        Assert.Equal("Done", entry.ToLabel);
    }

    [Fact]
    public async Task RenamingAColumnDoesNotRewriteWhatAlreadyHappened()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await MoveAsync(dbContext, alice, project.Id, task.Id, done.Id);

        done.Name = "Shipped";
        await dbContext.SaveChangesAsync();

        var entry = Assert.Single(await EntriesAsync(dbContext, project.Id));

        // The label was copied at write time. Resolving it now would make the past change every
        // time the board is reorganised, which is the opposite of what a log is for.
        Assert.Equal("Done", entry.ToLabel);
    }

    [Fact]
    public async Task NewestFirst_AndBoundedByTheLimit()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var first = await SeedTaskAsync(dbContext, project, todo, "First");
        var second = await SeedTaskAsync(dbContext, project, todo, "Second");

        await MoveAsync(dbContext, alice, project.Id, first.Id, done.Id);
        await MoveAsync(dbContext, alice, project.Id, second.Id, done.Id);

        var all = await EntriesAsync(dbContext, project.Id);
        // "What has happened since I last looked" reads newest first — the opposite of L30's
        // comment thread, which is read in the order it was said.
        Assert.Equal(["Second", "First"], all.Select(e => e.Subject));

        var capped = (await FeedAsync(dbContext, project.Id, limit: 1)).Value!;
        Assert.Equal("Second", Assert.Single(capped).Subject);

        // A feed only grows, so the ceiling is what stands in for the calendar's date window.
        var absurd = (await FeedAsync(dbContext, project.Id, limit: 10_000)).Value!;
        Assert.Equal(2, absurd.Count);
    }

    [Fact]
    public async Task AnotherProjectsHistoryIsNotInThisFeed()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (mine, mineTodo, mineDone) = await SeedProjectAsync(dbContext, "Mine", alice.Id);
        var (other, otherTodo, otherDone) = await SeedProjectAsync(dbContext, "Other", alice.Id);

        var here = await SeedTaskAsync(dbContext, mine, mineTodo, "Here");
        var there = await SeedTaskAsync(dbContext, other, otherTodo, "There");

        await MoveAsync(dbContext, alice, mine.Id, here.Id, mineDone.Id);
        await MoveAsync(dbContext, alice, other.Id, there.Id, otherDone.Id);

        Assert.Equal("Here", Assert.Single(await EntriesAsync(dbContext, mine.Id)).Subject);
        Assert.Equal("There", Assert.Single(await EntriesAsync(dbContext, other.Id)).Subject);
    }

    [Fact]
    public async Task DeletingAndRestoringAreBothRecorded()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await ProjectTasksEndpoints.DeleteTask(
            project.Id,
            task.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        await BlitzTask.Backend.Features.Trash.TrashEndpoints.RestoreTask(
            task.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var kinds = (await EntriesAsync(dbContext, project.Id)).Select(e => e.Kind).ToList();

        Assert.Equal([ActivityKind.TASK_RESTORED, ActivityKind.TASK_DELETED], kinds);
    }

    [Fact]
    public async Task AFailedMoveLeavesNoTraceOfHavingHappened()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        // A column that is not in this project: the handler bails before saving anything.
        var (other, otherTodo, _) = await SeedProjectAsync(dbContext, "Other", alice.Id);
        await MoveAsync(dbContext, alice, project.Id, task.Id, otherTodo.Id);

        // The recorder never saves on its own, so an event cannot outlive the operation that
        // was supposed to have caused it.
        Assert.Empty(await EntriesAsync(dbContext, project.Id));
    }
}
