using BlitzTask.Backend.Features.Activity;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.ProjectTasks;

/// <summary>
/// Doing one thing to many tasks (L38). The batch is one <c>SaveChanges</c>, so what these pin
/// is mostly what a loop over the single-task endpoints would have got wrong: a series that
/// advances on a drag but not on a bulk complete, successors scored identically because none of
/// them is written yet, a per-task tag cap broken by an edit that never mentioned the tags the
/// task already had, and a stale id failing the whole batch instead of doing less.
/// </summary>
public class BulkTasksTests
{
    private static readonly DateTimeOffset Monday = new(2026, 6, 1, 9, 0, 0, TimeSpan.Zero);

    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static async Task<ProjectTask> SeedRecurringAsync(
        ApplicationDbContext dbContext,
        Project project,
        ProjectColumn column,
        string name
    )
    {
        var task = await SeedTaskAsync(dbContext, project, column, name, Monday);
        task.Recurrence = new TaskRecurrence
        {
            Frequency = RecurrenceFrequency.WEEKLY,
            Interval = 1,
            Weekdays = [(int)DayOfWeek.Monday],
        };
        await dbContext.SaveChangesAsync();
        return task;
    }

    [Fact]
    public async Task MoveCarriesTheWholeSelectionAndKeepsItsRelativeOrder()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var first = await SeedTaskAsync(dbContext, project, todo, "First");
        var second = await SeedTaskAsync(dbContext, project, todo, "Second");
        var third = await SeedTaskAsync(dbContext, project, todo, "Third");
        first.Score = 3000;
        second.Score = 2000;
        third.Score = 1000;
        await dbContext.SaveChangesAsync();

        var result = await BulkTasksEndpoints.BulkMoveTasks(
            project.Id,
            new BulkMoveTasksRequest([third.Id, first.Id, second.Id], done.Id),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Equal(3, Assert.IsType<Ok<BulkTaskResult>>(result.Result).Value!.Affected);

        // Tasks render highest score first, so the order they had on the board is the order the
        // scores have to come out in — the request's own id order is irrelevant.
        var moved = await dbContext
            .ProjectTasks.Where(t => t.RelatedColumnId == done.Id)
            .OrderByDescending(t => t.Score)
            .Select(t => t.Name)
            .ToListAsync();

        string[] expected = ["First", "Second", "Third"];
        Assert.Equal(expected, moved);
    }

    [Fact]
    public async Task MoveScoresTheSelectionAboveWhatIsAlreadyInTheColumn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var sitting = await SeedTaskAsync(dbContext, project, done, "Already there");
        sitting.Score = 5000;
        var moving = await SeedTaskAsync(dbContext, project, todo, "Moving");
        await dbContext.SaveChangesAsync();

        await BulkTasksEndpoints.BulkMoveTasks(
            project.Id,
            new BulkMoveTasksRequest([moving.Id], done.Id),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.True(moving.Score > sitting.Score);
    }

    [Fact]
    public async Task MovingIntoTheLastColumnAdvancesEveryRecurringTaskExactlyOnce()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var rent = await SeedRecurringAsync(dbContext, project, todo, "Rent");
        var standup = await SeedRecurringAsync(dbContext, project, todo, "Standup");
        var plain = await SeedTaskAsync(dbContext, project, todo, "Plain");

        await BulkTasksEndpoints.BulkMoveTasks(
            project.Id,
            new BulkMoveTasksRequest([rent.Id, standup.Id, plain.Id], done.Id),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var successors = await dbContext
            .ProjectTasks.Where(t => t.RelatedColumnId == todo.Id)
            .ToListAsync();

        string[] expected = ["Rent", "Standup"];
        Assert.Equal(expected, successors.Select(t => t.Name).Order());

        // Two series advancing inside one SaveChanges: neither successor exists in the database
        // when the other is scored, so without consulting the change tracker both would land on
        // the same score and the board's order between them would be arbitrary.
        Assert.Equal(2, successors.Select(t => t.Score).Distinct().Count());
    }

    [Fact]
    public async Task MovingIntoTheLastColumnTwiceDoesNotAdvanceASeriesAgain()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var rent = await SeedRecurringAsync(dbContext, project, todo, "Rent");

        var request = new BulkMoveTasksRequest([rent.Id], done.Id);
        var context = ContextFor(alice);

        await BulkTasksEndpoints.BulkMoveTasks(
            project.Id,
            request,
            dbContext,
            context,
            CancellationToken.None
        );
        await BulkTasksEndpoints.BulkMoveTasks(
            project.Id,
            request,
            dbContext,
            context,
            CancellationToken.None
        );

        Assert.Equal(1, await dbContext.ProjectTasks.CountAsync(t => t.Name == "Rent" && t.RelatedColumnId == todo.Id));
    }

    [Fact]
    public async Task MoveRecordsCompletionOnlyForTasksThatChangedColumn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var moving = await SeedTaskAsync(dbContext, project, todo, "Moving");
        var alreadyDone = await SeedTaskAsync(dbContext, project, done, "Already done");

        await BulkTasksEndpoints.BulkMoveTasks(
            project.Id,
            new BulkMoveTasksRequest([moving.Id, alreadyDone.Id], done.Id),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        // Reordering within a column is not news. A bulk move is exactly where a feed would
        // otherwise fill up with entries saying nothing happened.
        var events = await dbContext.ActivityEvents.ToListAsync();
        Assert.Equal("Moving", Assert.Single(events).Subject);
        Assert.Equal(ActivityKind.TASK_COMPLETED, events[0].Kind);
    }

    [Fact]
    public async Task MoveIgnoresIdsFromAnotherProjectRatherThanFailingTheBatch()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (alpha, alphaTodo, alphaDone) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var (beta, betaTodo, _) = await SeedProjectAsync(dbContext, "Beta", alice.Id);

        var mine = await SeedTaskAsync(dbContext, alpha, alphaTodo, "Mine");
        var theirs = await SeedTaskAsync(dbContext, beta, betaTodo, "Theirs");

        var result = await BulkTasksEndpoints.BulkMoveTasks(
            alpha.Id,
            new BulkMoveTasksRequest([mine.Id, theirs.Id, 9999], alphaDone.Id),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Equal(1, Assert.IsType<Ok<BulkTaskResult>>(result.Result).Value!.Affected);
        Assert.Equal(betaTodo.Id, theirs.RelatedColumnId);
    }

    [Fact]
    public async Task MoveToAColumnOfAnotherProjectIsNotFound()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (alpha, alphaTodo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var (_, betaTodo, _) = await SeedProjectAsync(dbContext, "Beta", alice.Id);
        var task = await SeedTaskAsync(dbContext, alpha, alphaTodo, "Mine");

        var result = await BulkTasksEndpoints.BulkMoveTasks(
            alpha.Id,
            new BulkMoveTasksRequest([task.Id], betaTodo.Id),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.IsType<NotFound<ApiMessageResponse>>(result.Result);
    }

    [Fact]
    public async Task AddingATagLeavesTasksAlreadyAtTheCapAlone()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var room = await SeedTaskAsync(dbContext, project, todo, "Room to spare");
        var full = await SeedTaskAsync(dbContext, project, todo, "Full");
        full.Tags = ["a", "b", "c", "d", "e"];
        await dbContext.SaveChangesAsync();

        var result = await BulkTasksEndpoints.BulkTagTasks(
            project.Id,
            new BulkTagTasksRequest([room.Id, full.Id], ["release"], BulkEditMode.Add),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var counted = result.Value!;
        Assert.Equal(1, counted.Affected);
        Assert.Equal(1, counted.Skipped);

        Assert.Contains("release", room.Tags);
        // Refused, not truncated — truncating would drop a tag the request never mentioned.
        string[] untouched = ["a", "b", "c", "d", "e"];
        Assert.Equal(untouched, full.Tags);
    }

    [Fact]
    public async Task AddingATagATaskAlreadyHasChangesNothing()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Tagged");

        // SeedTaskAsync gives every task the "alpha" tag.
        var result = await BulkTasksEndpoints.BulkTagTasks(
            project.Id,
            new BulkTagTasksRequest([task.Id], ["alpha"], BulkEditMode.Add),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Equal(0, result.Value!.Affected);
        string[] expected = ["alpha"];
        Assert.Equal(expected, task.Tags);
    }

    [Fact]
    public async Task RemovingAndReplacingTags()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var removing = await SeedTaskAsync(dbContext, project, todo, "Removing");
        var replacing = await SeedTaskAsync(dbContext, project, todo, "Replacing");

        await BulkTasksEndpoints.BulkTagTasks(
            project.Id,
            new BulkTagTasksRequest([removing.Id], ["alpha"], BulkEditMode.Remove),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );
        await BulkTasksEndpoints.BulkTagTasks(
            project.Id,
            new BulkTagTasksRequest([replacing.Id], ["release"], BulkEditMode.Replace),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Empty(removing.Tags);
        string[] replaced = ["release"];
        Assert.Equal(replaced, replacing.Tags);
    }

    [Fact]
    public async Task AssigningIsRestrictedToPeopleOnTheProject()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var outsider = await TestsUtils.SeedUserAsync(dbContext, "outsider@example.com");
        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Contributor)
        );
        var task = await SeedTaskAsync(dbContext, project, todo, "Work");

        await BulkTasksEndpoints.BulkAssignTasks(
            project.Id,
            new BulkAssignTasksRequest([task.Id], [bob.Id, outsider.Id], BulkEditMode.Add),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        // An outsider would get the task on their "assigned to me" list and a 404 on opening it.
        int[] expected = [bob.Id];
        Assert.Equal(expected, task.Assignees.Select(a => a.Id));
    }

    [Fact]
    public async Task AddingAnAssigneeKeepsWhoeverWasAlreadyThereAndNotifiesOnlyTheNewOne()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var carol = await TestsUtils.SeedUserAsync(dbContext, "carol@example.com");
        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Contributor),
            (carol.Id, ProjectRole.Contributor)
        );
        var task = await SeedTaskAsync(dbContext, project, todo, "Work", null, ProjectTaskPriority.MEDIUM, bob);

        await BulkTasksEndpoints.BulkAssignTasks(
            project.Id,
            new BulkAssignTasksRequest([task.Id], [bob.Id, carol.Id], BulkEditMode.Add),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        int[] expected = [bob.Id, carol.Id];
        Assert.Equal(expected, task.Assignees.Select(a => a.Id).Order());

        // Bob was already on it. Telling him again is the bug a diff prevents.
        var notified = await dbContext.Notifications.Select(n => n.UserId).ToListAsync();
        Assert.Equal(carol.Id, Assert.Single(notified));
    }

    [Fact]
    public async Task RemovingAnAssigneeWorksEvenAfterTheyLeftTheProject()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var former = await TestsUtils.SeedUserAsync(dbContext, "former@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Work", null, ProjectTaskPriority.MEDIUM, former);

        // `former` is assigned but is not a participant — exactly the state left behind when
        // someone is removed from a project, and exactly when you would want to tidy it up.
        await BulkTasksEndpoints.BulkAssignTasks(
            project.Id,
            new BulkAssignTasksRequest([task.Id], [former.Id], BulkEditMode.Remove),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Empty(task.Assignees);
    }

    [Fact]
    public async Task ReplacingWithAnEmptyListClearsTheAssignees()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Contributor)
        );
        var task = await SeedTaskAsync(dbContext, project, todo, "Work", null, ProjectTaskPriority.MEDIUM, bob);

        await BulkTasksEndpoints.BulkAssignTasks(
            project.Id,
            new BulkAssignTasksRequest([task.Id], [], BulkEditMode.Replace),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Empty(task.Assignees);
    }

    [Fact]
    public async Task DeleteTrashesTheSelectionUnderOneInstantAndLeavesTheFilesAlone()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var first = await SeedTaskAsync(dbContext, project, todo, "First");
        var second = await SeedTaskAsync(dbContext, project, todo, "Second");
        var kept = await SeedTaskAsync(dbContext, project, todo, "Kept");

        var result = await BulkTasksEndpoints.BulkDeleteTasks(
            project.Id,
            new BulkDeleteTasksRequest([first.Id, second.Id]),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Equal(2, result.Value!.Affected);

        // The global query filter hides them, which is what the board reads.
        var remaining = await dbContext.ProjectTasks.Select(t => t.Name).ToListAsync();
        Assert.Equal("Kept", Assert.Single(remaining));

        var trashed = await dbContext
            .ProjectTasks.IgnoreQueryFilters()
            .Where(t => t.DeletedAt != null)
            .ToListAsync();

        // One instant across the batch, the same way a cascade stamps a parent and its children.
        Assert.Single(trashed.Select(t => t.DeletedAt).Distinct());
        Assert.Equal(2, await dbContext.ActivityEvents.CountAsync(e => e.Kind == ActivityKind.TASK_DELETED));
        Assert.Null(kept.DeletedAt);
    }

    [Fact]
    public async Task DeleteWillNotReachATaskInAnotherProject()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (alpha, alphaTodo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var (beta, betaTodo, _) = await SeedProjectAsync(dbContext, "Beta", alice.Id);
        var theirs = await SeedTaskAsync(dbContext, beta, betaTodo, "Theirs");
        await SeedTaskAsync(dbContext, alpha, alphaTodo, "Mine");

        var result = await BulkTasksEndpoints.BulkDeleteTasks(
            alpha.Id,
            new BulkDeleteTasksRequest([theirs.Id]),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Equal(0, result.Value!.Affected);
        Assert.Null(theirs.DeletedAt);
    }
}
