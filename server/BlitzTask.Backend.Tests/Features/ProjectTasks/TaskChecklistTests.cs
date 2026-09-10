using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.ProjectTasks;

/// <summary>
/// The checklist a task carries. Items ride on the task's own create/update request — a new task
/// has no id, so anything needing one could not be offered while writing it — but the ticked
/// state does not: it is written only by <c>PATCH .../checklist/{itemId}</c>.
/// <para>
/// That split is what most of these tests are about. Saving a task must reconcile the list
/// against what is already stored, so an item that was ticked while the sheet sat open survives
/// the save that follows.
/// </para>
/// </summary>
public class TaskChecklistTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static List<ChecklistItemInput> Items(params string[] texts) =>
        [.. texts.Select(t => new ChecklistItemInput { Text = t })];

    private static Task<List<TaskChecklistItem>> ChecklistOf(
        ApplicationDbContext dbContext,
        ProjectTask task
    ) =>
        dbContext
            .TaskChecklistItems.Where(c => c.ProjectTaskId == task.Id)
            .OrderBy(c => c.Position)
            .ToListAsync();

    private static Task UpdateAsync(
        ApplicationDbContext dbContext,
        User user,
        ProjectTask task,
        List<ChecklistItemInput>? checklist
    ) =>
        ProjectTasksEndpoints.UpdateTask(
            task.RelatedProjectId,
            task.Id,
            new UpdateProjectTaskRequest
            {
                Name = task.Name,
                Description = task.Description,
                Priority = task.Priority,
                Tags = [],
                StartDate = null,
                DueDate = null,
                AssigneeIds = null,
                ChecklistItems = checklist,
            },
            dbContext,
            ContextFor(user),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

    [Fact]
    public async Task CreateCarriesTheChecklistInTheOrderItWasSubmitted()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        await ProjectTasksEndpoints.CreateTask(
            project.Id,
            todo.Id,
            new CreateProjectTaskRequest
            {
                Name = "Ship the release",
                Description = "",
                Priority = ProjectTaskPriority.MEDIUM,
                ChecklistItems = Items("Tag the commit", "Write the notes", "Announce it"),
            },
            dbContext,
            ContextFor(alice),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

        var items = await dbContext
            .TaskChecklistItems.OrderBy(c => c.Position)
            .ToListAsync();

        Assert.Equal(
            ["Tag the commit", "Write the notes", "Announce it"],
            items.Select(i => i.Text)
        );
        Assert.Equal([0, 1, 2], items.Select(i => i.Position));
        Assert.All(items, i => Assert.False(i.IsDone));
    }

    [Fact]
    public async Task BlankItemsAreDroppedRatherThanStored()
    {
        // A row the user started and left empty. Failing the save over it would lose the edits
        // sitting around it, and storing it would put a nameless checkbox on the task.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        await ProjectTasksEndpoints.CreateTask(
            project.Id,
            todo.Id,
            new CreateProjectTaskRequest
            {
                Name = "Ship the release",
                Description = "",
                Priority = ProjectTaskPriority.MEDIUM,
                ChecklistItems = Items("Tag the commit", "   ", ""),
            },
            dbContext,
            ContextFor(alice),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

        var item = Assert.Single(await dbContext.TaskChecklistItems.ToListAsync());
        Assert.Equal("Tag the commit", item.Text);
        Assert.Equal(0, item.Position);
    }

    [Fact]
    public async Task UpdateAddsRemovesAndRenumbersToMatchTheSubmittedList()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await UpdateAsync(dbContext, alice, task, Items("First", "Second"));
        var stored = await ChecklistOf(dbContext, task);
        Assert.Equal(["First", "Second"], stored.Select(i => i.Text));

        // Keep the second, drop the first, add a third — and put them in the other order.
        await UpdateAsync(
            dbContext,
            alice,
            task,
            [
                new ChecklistItemInput { Text = "Third" },
                new ChecklistItemInput { Id = stored[1].Id, Text = "Second, renamed" },
            ]
        );

        var after = await ChecklistOf(dbContext, task);
        Assert.Equal(["Third", "Second, renamed"], after.Select(i => i.Text));
        Assert.Equal([0, 1], after.Select(i => i.Position));
        // The kept item is the same row, not a rebuilt one.
        Assert.Equal(stored[1].Id, after[1].Id);

        await UpdateAsync(dbContext, alice, task, []);
        Assert.Empty(await ChecklistOf(dbContext, task));
    }

    [Fact]
    public async Task SavingTheTaskDoesNotUntickAnItem()
    {
        // The reason the task request carries no IsDone at all. A sheet opened before someone
        // ticked something still holds the untouched list, and a save from it must not be able to
        // undo the tick.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await UpdateAsync(dbContext, alice, task, Items("Tag the commit"));
        var item = Assert.Single(await ChecklistOf(dbContext, task));

        await TaskChecklistEndpoints.SetItemDone(
            project.Id,
            task.Id,
            item.Id,
            new SetChecklistItemDoneRequest(true),
            dbContext,
            CancellationToken.None
        );

        await UpdateAsync(
            dbContext,
            alice,
            task,
            [new ChecklistItemInput { Id = item.Id, Text = "Tag the commit" }]
        );

        var after = Assert.Single(await ChecklistOf(dbContext, task));
        Assert.True(after.IsDone);
        Assert.Equal(item.Id, after.Id);
    }

    [Fact]
    public async Task TickingAnItemReturnsItAndPersists()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");
        await UpdateAsync(dbContext, alice, task, Items("Tag the commit"));
        var item = Assert.Single(await ChecklistOf(dbContext, task));

        var result = await TaskChecklistEndpoints.SetItemDone(
            project.Id,
            task.Id,
            item.Id,
            new SetChecklistItemDoneRequest(true),
            dbContext,
            CancellationToken.None
        );

        var details = Assert.IsType<
            Microsoft.AspNetCore.Http.HttpResults.Ok<ChecklistItemDetails>
        >(result.Result);
        Assert.True(details.Value!.IsDone);
        Assert.True((await ChecklistOf(dbContext, task))[0].IsDone);

        await TaskChecklistEndpoints.SetItemDone(
            project.Id,
            task.Id,
            item.Id,
            new SetChecklistItemDoneRequest(false),
            dbContext,
            CancellationToken.None
        );
        Assert.False((await ChecklistOf(dbContext, task))[0].IsDone);
    }

    [Fact]
    public async Task AnItemReachedThroughTheWrongProjectIsNotFound()
    {
        // The permission filter authorises the project in the route; the item has to actually
        // belong to it, or membership of one project would be a way into another's tasks.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (alpha, alphaTodo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var (beta, _, _) = await SeedProjectAsync(dbContext, "Beta", alice.Id);
        var task = await SeedTaskAsync(dbContext, alpha, alphaTodo, "Ship it");
        await UpdateAsync(dbContext, alice, task, Items("Tag the commit"));
        var item = Assert.Single(await ChecklistOf(dbContext, task));

        var result = await TaskChecklistEndpoints.SetItemDone(
            beta.Id,
            task.Id,
            item.Id,
            new SetChecklistItemDoneRequest(true),
            dbContext,
            CancellationToken.None
        );

        Assert.IsType<
            Microsoft.AspNetCore.Http.HttpResults.NotFound<
                BlitzTask.Backend.Features.Shared.Models.ApiMessageResponse
            >
        >(result.Result);
        Assert.False((await ChecklistOf(dbContext, task))[0].IsDone);
    }

    [Fact]
    public async Task TheBoardsOwnQueryReturnsEachTasksChecklistInOrder()
    {
        // SelectProjectDetails is what GET /api/projects/{id} runs, and the checklist is a
        // nested ordered subquery inside it. Against SQLite rather than the in-memory provider
        // on purpose: an untranslatable projection throws when the query runs, not when it
        // compiles, so this is the only kind of test that can catch the board 500ing.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");
        await UpdateAsync(dbContext, alice, task, Items("Tag the commit", "Announce it"));

        // Stored back to front, so an accidental insertion-order read would show up.
        var stored = await ChecklistOf(dbContext, task);
        stored[0].Position = 1;
        stored[1].Position = 0;
        await dbContext.SaveChangesAsync();

        var details = await dbContext
            .Projects.Where(p => p.Id == project.Id)
            .SelectProjectDetails()
            .FirstAsync();

        var rendered = details.Columns.Single(c => c.Id == todo.Id).Tasks.Single();
        Assert.Equal(
            ["Announce it", "Tag the commit"],
            rendered.ChecklistItems.Select(i => i.Text)
        );
    }

    [Fact]
    public async Task MovingATaskGivesTheChecklistBackWithIt()
    {
        // MoveTask returns a full ProjectTaskDetails and the board writes it straight into the
        // cache, so an Include missing there reads as the drag having wiped the checklist.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");
        await UpdateAsync(dbContext, alice, task, Items("Tag the commit", "Announce it"));

        var result = await ProjectTasksEndpoints.MoveTask(
            project.Id,
            task.Id,
            new MoveProjectTaskRequest(done.Id, 2000f),
            dbContext,
            CancellationToken.None
        );

        var ok = Assert.IsType<
            Microsoft.AspNetCore.Http.HttpResults.Ok<ProjectTaskDetails>
        >(result.Result);
        Assert.Equal(
            ["Tag the commit", "Announce it"],
            ok.Value!.ChecklistItems.Select(i => i.Text)
        );
    }
}
