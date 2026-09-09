using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.ProjectTasks;

/// <summary>
/// Reminders carried on the task's own create/update request. The separate reminders endpoints
/// still exist, but they need a task that already has an id and a saved due date, which forced
/// "save, reopen, then add a reminder" for what the user experiences as one thought.
/// <para>
/// What is worth pinning here is the reconciliation: the caller's offsets replace the caller's
/// reminders, without rebuilding rows that already fired and without touching anyone else's.
/// </para>
/// </summary>
public class TaskFormRemindersTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static Task<
        Microsoft.AspNetCore.Http.HttpResults.Results<
            Microsoft.AspNetCore.Http.HttpResults.Ok<ProjectTaskDetails>,
            Microsoft.AspNetCore.Http.HttpResults.NotFound<ApiMessageResponse>
        >
    > UpdateAsync(
        ApplicationDbContext dbContext,
        User user,
        ProjectTask task,
        DateTimeOffset? dueDate,
        List<int>? reminders
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
                DueDate = dueDate,
                AssigneeIds = null,
                ReminderMinutesBeforeDue = reminders,
            },
            dbContext,
            ContextFor(user),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

    private static Task<List<TaskReminder>> RemindersOf(
        ApplicationDbContext dbContext,
        ProjectTask task
    ) =>
        dbContext
            .TaskReminders.Where(r => r.ProjectTaskId == task.Id)
            .OrderBy(r => r.MinutesBeforeDue)
            .ToListAsync();

    [Fact]
    public async Task CreateCarriesTheCallersReminders()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var due = DateTimeOffset.UtcNow.AddDays(3);

        await ProjectTasksEndpoints.CreateTask(
            project.Id,
            todo.Id,
            new CreateProjectTaskRequest
            {
                Name = "Ship it",
                Description = "",
                Priority = ProjectTaskPriority.MEDIUM,
                DueDate = due,
                ReminderMinutesBeforeDue = [60, 1440],
            },
            dbContext,
            ContextFor(alice),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

        var reminders = await dbContext.TaskReminders.OrderBy(r => r.MinutesBeforeDue).ToListAsync();
        Assert.Equal([60, 1440], reminders.Select(r => r.MinutesBeforeDue));
        Assert.All(reminders, r => Assert.Equal(alice.Id, r.UserId));
        Assert.Equal(
            TaskReminder.ResolveRemindAt(due, 60),
            reminders[0].RemindAt,
            TimeSpan.FromSeconds(1)
        );
    }

    [Fact]
    public async Task CreateIgnoresRemindersWhenThereIsNoDueDate()
    {
        // Nothing to be relative to; the alternative is storing a row that can never fire.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        await ProjectTasksEndpoints.CreateTask(
            project.Id,
            todo.Id,
            new CreateProjectTaskRequest
            {
                Name = "Someday",
                Description = "",
                Priority = ProjectTaskPriority.MEDIUM,
                DueDate = null,
                ReminderMinutesBeforeDue = [60],
            },
            dbContext,
            ContextFor(alice),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

        Assert.Empty(await dbContext.TaskReminders.ToListAsync());
    }

    [Fact]
    public async Task UpdateAddsAndRemovesToMatchTheSubmittedOffsets()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var due = DateTimeOffset.UtcNow.AddDays(2);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", due);

        await UpdateAsync(dbContext, alice, task, due, [60]);
        Assert.Equal([60], (await RemindersOf(dbContext, task)).Select(r => r.MinutesBeforeDue));

        await UpdateAsync(dbContext, alice, task, due, [1440]);
        Assert.Equal([1440], (await RemindersOf(dbContext, task)).Select(r => r.MinutesBeforeDue));

        await UpdateAsync(dbContext, alice, task, due, []);
        Assert.Empty(await RemindersOf(dbContext, task));
    }

    [Fact]
    public async Task UpdateKeepsAnAlreadySentReminderInsteadOfRebuildingIt()
    {
        // The reason this is reconciled rather than deleted-and-recreated: a rebuilt row comes
        // back with SentAt null, and the sweep fires anything whose SentAt is behind its
        // RemindAt — so saving an unrelated edit would re-send yesterday's email.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var due = DateTimeOffset.UtcNow.AddHours(1);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", due);

        var sentAt = DateTime.UtcNow.AddMinutes(-5);
        dbContext.TaskReminders.Add(
            new TaskReminder
            {
                ProjectTaskId = task.Id,
                UserId = alice.Id,
                MinutesBeforeDue = 60,
                RemindAt = TaskReminder.ResolveRemindAt(due, 60),
                SentAt = sentAt,
            }
        );
        await dbContext.SaveChangesAsync();

        await UpdateAsync(dbContext, alice, task, due, [60]);

        var reminder = Assert.Single(await RemindersOf(dbContext, task));
        Assert.Equal(sentAt, reminder.SentAt!.Value, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task UpdateLeavesOtherMembersRemindersAlone()
    {
        // A reminder is private. Bob's must survive Alice saving the task, and must not be
        // readable through what Alice gets back either.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, BlitzTask.Backend.Features.Projects.ProjectRole.Collaborator)
        );
        var due = DateTimeOffset.UtcNow.AddDays(2);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", due);

        dbContext.TaskReminders.Add(
            new TaskReminder
            {
                ProjectTaskId = task.Id,
                UserId = bob.Id,
                MinutesBeforeDue = 15,
                RemindAt = TaskReminder.ResolveRemindAt(due, 15),
            }
        );
        await dbContext.SaveChangesAsync();

        await UpdateAsync(dbContext, alice, task, due, []);

        var remaining = Assert.Single(await RemindersOf(dbContext, task));
        Assert.Equal(bob.Id, remaining.UserId);
    }

    [Fact]
    public async Task MovingTheDueDateMovesTheRemindersWithIt()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var due = DateTimeOffset.UtcNow.AddDays(2);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", due);

        await UpdateAsync(dbContext, alice, task, due, [60]);

        var moved = due.AddDays(5);
        await UpdateAsync(dbContext, alice, task, moved, [60]);

        var reminder = Assert.Single(await RemindersOf(dbContext, task));
        Assert.Equal(
            TaskReminder.ResolveRemindAt(moved, 60),
            reminder.RemindAt,
            TimeSpan.FromSeconds(1)
        );
    }

    [Fact]
    public async Task ClearingTheDueDateKeepsTheRemindersForWhenItComesBack()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var due = DateTimeOffset.UtcNow.AddDays(2);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", due);

        await UpdateAsync(dbContext, alice, task, due, [60]);
        // The sheet sends no offsets once there is no deadline to be relative to; that must not
        // read as "delete them".
        await UpdateAsync(dbContext, alice, task, null, []);

        Assert.Equal([60], (await RemindersOf(dbContext, task)).Select(r => r.MinutesBeforeDue));
    }
}
