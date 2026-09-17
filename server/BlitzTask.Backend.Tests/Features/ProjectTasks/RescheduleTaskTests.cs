using BlitzTask.Backend.Features.Auth;
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
/// PATCH /api/tasks/{id}/schedule — dropping a task on another day of the calendar.
/// <para>
/// Deliberately not <c>/move</c>: that one changes a task's position within a column and takes a
/// score, this one changes when the work is due and touches no position at all. The two things
/// worth pinning are the ones a second implementation would get wrong — the span travelling with
/// the deadline, and the reminders that hang off it.
/// </para>
/// </summary>
public class RescheduleTaskTests
{
    private static readonly DateTimeOffset Due = new(2026, 6, 10, 17, 0, 0, TimeSpan.Zero);

    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static Task<IResult> RescheduleAsync(
        ApplicationDbContext dbContext,
        User user,
        int taskId,
        DateTimeOffset dueDate
    ) =>
        ProjectTasksEndpoints.RescheduleTask(
            taskId,
            new RescheduleTaskRequest(dueDate),
            dbContext,
            ContextFor(user),
            CancellationToken.None
        );

    [Fact]
    public async Task MovesTheDeadlineAndLeavesThePositionAlone()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", Due);

        var result = await RescheduleAsync(dbContext, alice, task.Id, Due.AddDays(3));

        var summary = Assert.IsType<Ok<UserTaskSummary>>(result).Value!;
        Assert.Equal(Due.AddDays(3), summary.DueDate);

        var moved = await dbContext.ProjectTasks.SingleAsync(t => t.Id == task.Id);
        // A calendar drop says nothing about status or order — the task stays exactly where it
        // sits on the board.
        Assert.Equal(todo.Id, moved.RelatedColumnId);
        Assert.Equal(task.Score, moved.Score);
    }

    [Fact]
    public async Task ASpanTravelsWholeRatherThanBeingStretched()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Long haul", Due);
        task.StartDate = Due.AddDays(-4);
        await dbContext.SaveChangesAsync();

        await RescheduleAsync(dbContext, alice, task.Id, Due.AddDays(7));

        var moved = await dbContext.ProjectTasks.SingleAsync(t => t.Id == task.Id);
        // Dragging a bar moves it; resizing one is a different gesture the calendar does not
        // offer. Shifting only the due end would silently turn a 4-day task into an 11-day one.
        Assert.Equal(Due.AddDays(7), moved.DueDate);
        Assert.Equal(Due.AddDays(3), moved.StartDate);
    }

    [Fact]
    public async Task AnUndatedTaskGainsADeadlineWithoutDisturbingItsStart()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Someday");
        task.StartDate = Due;
        await dbContext.SaveChangesAsync();

        // Nothing to shift from, so the start stays put — there is no span length to preserve.
        await RescheduleAsync(dbContext, alice, task.Id, Due.AddDays(2));

        var moved = await dbContext.ProjectTasks.SingleAsync(t => t.Id == task.Id);
        Assert.Equal(Due.AddDays(2), moved.DueDate);
        Assert.Equal(Due, moved.StartDate);
    }

    [Fact]
    public async Task RefusesADeadlineBeforeAStartItCannotShift()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Started, never due");
        task.StartDate = Due;
        await dbContext.SaveChangesAsync();

        var result = await RescheduleAsync(dbContext, alice, task.Id, Due.AddDays(-1));

        // Only reachable on a task with no deadline: give it one and the delta moves both ends,
        // so their order cannot change however far the task is dragged.
        Assert.IsType<BadRequest<ApiMessageResponse>>(result);
        var untouched = await dbContext.ProjectTasks.SingleAsync(t => t.Id == task.Id);
        Assert.Null(untouched.DueDate);
    }

    [Fact]
    public async Task MovesEveryonesRemindersWithTheDeadline()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Collaborator)
        );
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", Due);

        dbContext.TaskReminders.AddRange(
            new TaskReminder
            {
                ProjectTaskId = task.Id,
                UserId = alice.Id,
                MinutesBeforeDue = 60,
                RemindAt = TaskReminder.ResolveRemindAt(Due, 60),
            },
            new TaskReminder
            {
                ProjectTaskId = task.Id,
                UserId = bob.Id,
                MinutesBeforeDue = 1440,
                RemindAt = TaskReminder.ResolveRemindAt(Due, 1440),
            }
        );
        await dbContext.SaveChangesAsync();

        var newDue = Due.AddDays(5);
        await RescheduleAsync(dbContext, alice, task.Id, newDue);

        var reminders = await dbContext
            .TaskReminders.Where(r => r.ProjectTaskId == task.Id)
            .ToListAsync();

        // RemindAt is derived from the due date, so a stored firing time goes stale the moment
        // the deadline moves — and a reminder is personal in who receives it, not in when it
        // fires, so Alice moving the task has to re-arm Bob's too.
        foreach (var reminder in reminders)
        {
            Assert.Equal(
                TaskReminder.ResolveRemindAt(newDue, reminder.MinutesBeforeDue),
                reminder.RemindAt
            );
        }
    }

    [Fact]
    public async Task PushingADeadlineForwardRearmsAReminderThatAlreadyFired()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", Due);

        var sentAt = TaskReminder.ResolveRemindAt(Due, 60);
        dbContext.TaskReminders.Add(
            new TaskReminder
            {
                ProjectTaskId = task.Id,
                UserId = alice.Id,
                MinutesBeforeDue = 60,
                RemindAt = sentAt,
                SentAt = sentAt,
            }
        );
        await dbContext.SaveChangesAsync();

        await RescheduleAsync(dbContext, alice, task.Id, Due.AddDays(5));

        var reminder = await dbContext.TaskReminders.SingleAsync(r =>
            r.ProjectTaskId == task.Id
        );

        // Nothing here clears SentAt, and nothing needs to: the sweep fires on
        // `SentAt < RemindAt`, so moving RemindAt past the recorded send re-arms it for free.
        // Clearing it would be the same decision made twice, in two places.
        Assert.NotNull(reminder.SentAt);
        Assert.True(reminder.SentAt < reminder.RemindAt);
    }

    [Fact]
    public async Task AViewerCannotRescheduleWorkTheyCanSee()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Viewer)
        );
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", Due);

        var result = await RescheduleAsync(dbContext, bob, task.Id, Due.AddDays(3));

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<JsonHttpResult<ApiMessageResponse>>(result).StatusCode);
        var untouched = await dbContext.ProjectTasks.SingleAsync(t => t.Id == task.Id);
        Assert.Equal(Due, untouched.DueDate);
    }

    [Fact]
    public async Task ATaskInAProjectTheCallerIsNotInReadsAsNotFound()
    {
        // Same rule as RequireProjectPermissionFilter: non-membership must be indistinguishable
        // from non-existence, or the endpoint enumerates task ids.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (bobsProject, todo, _) = await SeedProjectAsync(dbContext, "Bob's", bob.Id);
        var task = await SeedTaskAsync(dbContext, bobsProject, todo, "Private", Due);

        var result = await RescheduleAsync(dbContext, alice, task.Id, Due.AddDays(3));

        Assert.IsType<NotFound<ApiMessageResponse>>(result);
        var untouched = await dbContext.ProjectTasks.SingleAsync(t => t.Id == task.Id);
        Assert.Equal(Due, untouched.DueDate);
    }
}
