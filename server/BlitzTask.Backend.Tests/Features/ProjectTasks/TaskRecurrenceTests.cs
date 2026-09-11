using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.ProjectTasks;

/// <summary>
/// Recurring tasks, materialised one occurrence at a time: completing an instance writes the
/// next one. The rule is stored, the schedule is not — so an instance is an ordinary task and
/// the board, the scores, RBAC, reminders and checklists need to know nothing about any of this.
/// <para>
/// The date arithmetic is anchored on the previous <b>due date</b> rather than on when the task
/// was ticked, so a weekly obligation cannot drift through the week; the catch-up loop is what
/// stops that anchoring from generating a backlog of already-overdue occurrences.
/// </para>
/// </summary>
public class TaskRecurrenceTests
{
    private static readonly DateTimeOffset Monday = new(2026, 6, 1, 9, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset LongAgo = new(2020, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static TaskRecurrence Rule(
        RecurrenceFrequency frequency,
        int interval = 1,
        params DayOfWeek[] weekdays
    ) =>
        new()
        {
            Frequency = frequency,
            Interval = interval,
            Weekdays = [.. weekdays.Select(d => (int)d)],
        };

    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    [Fact]
    public void AdvancesByTheInterval()
    {
        Assert.Equal(
            Monday.AddDays(1),
            TaskRecurrence.NextDueDate(Rule(RecurrenceFrequency.DAILY), Monday, LongAgo)
        );
        Assert.Equal(
            Monday.AddDays(21),
            TaskRecurrence.NextDueDate(Rule(RecurrenceFrequency.WEEKLY, 3), Monday, LongAgo)
        );
        Assert.Equal(
            Monday.AddMonths(2),
            TaskRecurrence.NextDueDate(Rule(RecurrenceFrequency.MONTHLY, 2), Monday, LongAgo)
        );
        Assert.Equal(
            Monday.AddYears(1),
            TaskRecurrence.NextDueDate(Rule(RecurrenceFrequency.YEARLY), Monday, LongAgo)
        );
    }

    [Fact]
    public void WeeklyWithWeekdaysStaysInsideTheWeekBeforeApplyingTheInterval()
    {
        // "Every other Monday and Thursday" means both days of the weeks it runs in — not one
        // day every other week. So Monday's successor is that same Thursday, and only crossing
        // into a new week costs the interval.
        var rule = Rule(RecurrenceFrequency.WEEKLY, 2, DayOfWeek.Monday, DayOfWeek.Thursday);

        var thursday = TaskRecurrence.NextDueDate(rule, Monday, LongAgo);
        Assert.Equal(new DateTimeOffset(2026, 6, 4, 9, 0, 0, TimeSpan.Zero), thursday);

        var mondayAfterNext = TaskRecurrence.NextDueDate(rule, thursday, LongAgo);
        Assert.Equal(new DateTimeOffset(2026, 6, 15, 9, 0, 0, TimeSpan.Zero), mondayAfterNext);
    }

    [Fact]
    public void TickingLateKeepsTheSeriesOnItsOwnDays()
    {
        // The reason the anchor is the due date and not the completion date. Rent is due on the
        // 1st; paying it on the 3rd must not move rent to the 3rd forever.
        var rule = Rule(RecurrenceFrequency.WEEKLY);
        var tickedTwoDaysLate = Monday.AddDays(2);

        Assert.Equal(
            Monday.AddDays(7),
            TaskRecurrence.NextDueDate(rule, Monday, tickedTwoDaysLate)
        );
    }

    [Fact]
    public void ASeriesLeftAloneCatchesUpInsteadOfPilingUp()
    {
        // Four missed weeks should leave one occurrence due next Monday, not four rows demanding
        // attention for Mondays that have already gone.
        var rule = Rule(RecurrenceFrequency.WEEKLY);
        var nearlyFourWeeksLate = new DateTimeOffset(2026, 6, 26, 17, 0, 0, TimeSpan.Zero);

        var next = TaskRecurrence.NextDueDate(rule, Monday, nearlyFourWeeksLate);

        Assert.Equal(new DateTimeOffset(2026, 6, 29, 9, 0, 0, TimeSpan.Zero), next);
        Assert.True(next > nearlyFourWeeksLate);
    }

    [Fact]
    public void MonthlyClampsRatherThanSpillingIntoTheFollowingMonth()
    {
        // The 31st of January has no counterpart in February. Clamping is the lesser wrong:
        // spilling would put a "monthly" task in March.
        var lastOfJanuary = new DateTimeOffset(2026, 1, 31, 9, 0, 0, TimeSpan.Zero);

        var next = TaskRecurrence.NextDueDate(
            Rule(RecurrenceFrequency.MONTHLY),
            lastOfJanuary,
            LongAgo
        );

        Assert.Equal(new DateTimeOffset(2026, 2, 28, 9, 0, 0, TimeSpan.Zero), next);
    }

    [Fact]
    public async Task CompletingARecurringTaskWritesTheNextOccurrence()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var due = DateTimeOffset.UtcNow.AddDays(1);
        var task = await SeedTaskAsync(dbContext, project, todo, "Pay rent", due);
        task.Recurrence = Rule(RecurrenceFrequency.WEEKLY);
        await dbContext.SaveChangesAsync();

        await ProjectTasksEndpoints.MoveTask(
            project.Id,
            task.Id,
            new MoveProjectTaskRequest(done.Id, 2000f),
            dbContext,
            CancellationToken.None
        );

        var spawned = await dbContext
            .ProjectTasks.Include(t => t.Recurrence)
            .SingleAsync(t => t.Id != task.Id);

        Assert.Equal("Pay rent", spawned.Name);
        Assert.Equal(due.AddDays(7), spawned.DueDate!.Value, TimeSpan.FromSeconds(1));
        // Back at the start of the board, not sitting in Done next to its predecessor.
        Assert.Equal(todo.Id, spawned.RelatedColumnId);
        Assert.NotNull(spawned.Recurrence);
        Assert.Equal(RecurrenceFrequency.WEEKLY, spawned.Recurrence!.Frequency);
    }

    [Fact]
    public async Task DraggingOutOfDoneAndBackDoesNotSpawnASecondOccurrence()
    {
        // Completion is a position, so leaving and re-entering the last column is an ordinary
        // thing to do. Without the guard every one of those drops mints another instance.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(
            dbContext,
            project,
            todo,
            "Pay rent",
            DateTimeOffset.UtcNow.AddDays(1)
        );
        task.Recurrence = Rule(RecurrenceFrequency.WEEKLY);
        await dbContext.SaveChangesAsync();

        async Task MoveTo(int columnId) =>
            await ProjectTasksEndpoints.MoveTask(
                project.Id,
                task.Id,
                new MoveProjectTaskRequest(columnId, 2000f),
                dbContext,
                CancellationToken.None
            );

        await MoveTo(done.Id);
        await MoveTo(todo.Id);
        await MoveTo(done.Id);

        Assert.Equal(2, await dbContext.ProjectTasks.CountAsync());
    }

    [Fact]
    public async Task MovingWithinTheBoardDoesNotSpawnAnything()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(
            dbContext,
            project,
            todo,
            "Pay rent",
            DateTimeOffset.UtcNow.AddDays(1)
        );
        task.Recurrence = Rule(RecurrenceFrequency.WEEKLY);
        await dbContext.SaveChangesAsync();

        await ProjectTasksEndpoints.MoveTask(
            project.Id,
            task.Id,
            new MoveProjectTaskRequest(todo.Id, 500f),
            dbContext,
            CancellationToken.None
        );

        Assert.Equal(1, await dbContext.ProjectTasks.CountAsync());
    }

    [Fact]
    public async Task ARuleWithNoDueDateHasNothingToAdvanceFrom()
    {
        // Kept rather than rejected, mirroring reminders: clearing a deadline should not quietly
        // throw away the intention to repeat.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Someday");
        task.Recurrence = Rule(RecurrenceFrequency.WEEKLY);
        await dbContext.SaveChangesAsync();

        await ProjectTasksEndpoints.MoveTask(
            project.Id,
            task.Id,
            new MoveProjectTaskRequest(done.Id, 2000f),
            dbContext,
            CancellationToken.None
        );

        Assert.Equal(1, await dbContext.ProjectTasks.CountAsync());
        Assert.NotNull(await dbContext.TaskRecurrences.SingleOrDefaultAsync());
    }

    [Fact]
    public async Task TheNextOccurrenceCarriesTheWorkForwardButNotTheProgress()
    {
        // A checklist describes the steps, not the last time they were done, so it comes over
        // unticked. Reminders come over re-armed: it is a different deadline, so one that already
        // fired has to fire again.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var due = DateTimeOffset.UtcNow.AddDays(1);
        var task = await SeedTaskAsync(dbContext, project, todo, "Weekly review", due);
        task.Recurrence = Rule(RecurrenceFrequency.WEEKLY);
        task.ChecklistItems =
        [
            new TaskChecklistItem { Text = "Empty the inbox", Position = 0, IsDone = true },
            new TaskChecklistItem { Text = "Plan the week", Position = 1, IsDone = true },
        ];
        task.Reminders =
        [
            new TaskReminder
            {
                UserId = alice.Id,
                MinutesBeforeDue = 60,
                RemindAt = TaskReminder.ResolveRemindAt(due, 60),
                SentAt = DateTime.UtcNow,
            },
        ];
        await dbContext.SaveChangesAsync();

        await ProjectTasksEndpoints.MoveTask(
            project.Id,
            task.Id,
            new MoveProjectTaskRequest(done.Id, 2000f),
            dbContext,
            CancellationToken.None
        );

        var spawned = await dbContext
            .ProjectTasks.Include(t => t.ChecklistItems)
            .Include(t => t.Reminders)
            .SingleAsync(t => t.Id != task.Id);

        Assert.Equal(
            ["Empty the inbox", "Plan the week"],
            spawned.ChecklistItems.OrderBy(c => c.Position).Select(c => c.Text)
        );
        Assert.All(spawned.ChecklistItems, c => Assert.False(c.IsDone));

        var reminder = Assert.Single(spawned.Reminders);
        Assert.Null(reminder.SentAt);
        Assert.Equal(
            TaskReminder.ResolveRemindAt(spawned.DueDate!.Value, 60),
            reminder.RemindAt,
            TimeSpan.FromSeconds(1)
        );
    }

    [Fact]
    public async Task TheRuleRidesOnTheTaskFormLikeTheChecklistDoes()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        await ProjectTasksEndpoints.CreateTask(
            project.Id,
            todo.Id,
            new CreateProjectTaskRequest
            {
                Name = "Pay rent",
                Description = "",
                Priority = ProjectTaskPriority.MEDIUM,
                DueDate = DateTimeOffset.UtcNow.AddDays(1),
                Recurrence = new RecurrenceInput
                {
                    Frequency = RecurrenceFrequency.WEEKLY,
                    Interval = 2,
                    Weekdays = [(int)DayOfWeek.Monday, (int)DayOfWeek.Monday],
                },
            },
            dbContext,
            ContextFor(alice),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

        var task = await dbContext.ProjectTasks.Include(t => t.Recurrence).SingleAsync();
        Assert.Equal(2, task.Recurrence!.Interval);
        // Deduplicated on the way in, so the weekly walk cannot trip over a repeated day.
        Assert.Equal([(int)DayOfWeek.Monday], task.Recurrence.Weekdays);

        // And clearing it on an update removes the rule rather than leaving an orphan.
        await ProjectTasksEndpoints.UpdateTask(
            project.Id,
            task.Id,
            new UpdateProjectTaskRequest
            {
                Name = task.Name,
                Description = task.Description,
                Priority = task.Priority,
                Tags = [],
                DueDate = task.DueDate,
                Recurrence = null,
            },
            dbContext,
            ContextFor(alice),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

        Assert.Empty(await dbContext.TaskRecurrences.ToListAsync());
    }

    [Fact]
    public async Task WeekdaysAreDroppedOnARuleThatIsNotWeekly()
    {
        // Switching the sheet's frequency away from weekly leaves the weekday control's state
        // behind. Storing it would make a monthly rule carry days that nothing reads.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        await ProjectTasksEndpoints.CreateTask(
            project.Id,
            todo.Id,
            new CreateProjectTaskRequest
            {
                Name = "Pay rent",
                Description = "",
                Priority = ProjectTaskPriority.MEDIUM,
                Recurrence = new RecurrenceInput
                {
                    Frequency = RecurrenceFrequency.MONTHLY,
                    Interval = 1,
                    Weekdays = [(int)DayOfWeek.Monday],
                },
            },
            dbContext,
            ContextFor(alice),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

        var task = await dbContext.ProjectTasks.Include(t => t.Recurrence).SingleAsync();
        Assert.Empty(task.Recurrence!.Weekdays);
    }
}
