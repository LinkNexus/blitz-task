using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.ProjectTasks;

/// <summary>
/// Covers the projection behind GET /api/tasks. Real SQLite, not the in-memory provider: the
/// whole point of these queries is that they translate to SQL, and the in-memory provider would
/// evaluate the completion subquery client-side and pass regardless.
/// </summary>
public class UserTaskSummariesTests
{
    [Fact]
    public async Task ReturnsOnlyTasksFromProjectsTheUserParticipatesIn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");

        var (aliceProject, aliceTodo, _) = await UserTasksTestData.SeedProjectAsync(dbContext, "Alice", alice.Id);
        var (bobProject, bobTodo, _) = await UserTasksTestData.SeedProjectAsync(dbContext, "Bob", bob.Id);
        var (shared, sharedTodo, _) = await UserTasksTestData.SeedProjectAsync(
            dbContext,
            "Shared",
            alice.Id,
            (bob.Id, ProjectRole.Viewer)
        );

        await UserTasksTestData.SeedTaskAsync(dbContext, aliceProject, aliceTodo, "Alice task");
        await UserTasksTestData.SeedTaskAsync(dbContext, bobProject, bobTodo, "Bob task");
        await UserTasksTestData.SeedTaskAsync(dbContext, shared, sharedTodo, "Shared task");

        var forAlice = await dbContext
            .ProjectTasks.SelectUserTaskSummariesFor(alice.Id)
            .ToListAsync();

        Assert.Equal(["Alice task", "Shared task"], forAlice.Select(t => t.Name).OrderBy(n => n));
    }

    [Fact]
    public async Task CarriesTheOwningProjectAndColumn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await UserTasksTestData.SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "Write the thing");

        var summary = await dbContext.ProjectTasks.SelectUserTaskSummariesFor(alice.Id).SingleAsync();

        Assert.Equal(project.Id, summary.ProjectId);
        Assert.Equal("Alpha", summary.ProjectName);
        Assert.Equal(todo.Id, summary.ColumnId);
        Assert.Equal("Todo", summary.ColumnName);
        Assert.Equal("#FF0000", summary.ColumnColor);
        // Tags round-trip through a value converter, so they are worth asserting explicitly.
        Assert.Equal(["alpha"], summary.Tags);
    }

    [Fact]
    public async Task IsCompleted_IsTrueOnlyInTheHighestScoreColumn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await UserTasksTestData.SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "Open");
        await UserTasksTestData.SeedTaskAsync(dbContext, project, done, "Shipped");

        var summaries = await dbContext
            .ProjectTasks.SelectUserTaskSummariesFor(alice.Id)
            .ToDictionaryAsync(t => t.Name, t => t.IsCompleted);

        Assert.False(summaries["Open"]);
        Assert.True(summaries["Shipped"]);
    }

    [Fact]
    public async Task IsCompleted_IsPerProject_NotGlobalScore()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        // Scores are per-project floats with no shared scale, so a task in project A's last
        // column is done even when project B has columns scoring far higher.
        var (alpha, alphaTodo, alphaDone) = await UserTasksTestData.SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var (beta, _, betaDone) = await UserTasksTestData.SeedProjectAsync(dbContext, "Beta", alice.Id);
        betaDone.Score = 999_999;
        await dbContext.SaveChangesAsync();

        await UserTasksTestData.SeedTaskAsync(dbContext, alpha, alphaDone, "Alpha done");
        await UserTasksTestData.SeedTaskAsync(dbContext, alpha, alphaTodo, "Alpha open");
        await UserTasksTestData.SeedTaskAsync(dbContext, beta, betaDone, "Beta done");

        var summaries = await dbContext
            .ProjectTasks.SelectUserTaskSummariesFor(alice.Id)
            .ToDictionaryAsync(t => t.Name, t => t.IsCompleted);

        Assert.True(summaries["Alpha done"]);
        Assert.False(summaries["Alpha open"]);
        Assert.True(summaries["Beta done"]);
    }

    [Fact]
    public async Task IncompleteTasks_ExcludesTheLastColumn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await UserTasksTestData.SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "Open");
        await UserTasksTestData.SeedTaskAsync(dbContext, project, done, "Shipped");

        var open = await dbContext
            .ProjectTasks.IncompleteTasks()
            .SelectUserTaskSummariesFor(alice.Id)
            .ToListAsync();

        Assert.Equal(["Open"], open.Select(t => t.Name));
    }

    [Fact]
    public async Task CarriesAssigneeIds()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, todo, _) = await UserTasksTestData.SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Contributor)
        );
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "Pair task", null, ProjectTaskPriority.MEDIUM, alice, bob);
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "Nobody's task");

        var summaries = await dbContext
            .ProjectTasks.SelectUserTaskSummariesFor(alice.Id)
            .ToDictionaryAsync(t => t.Name, t => t.AssigneeIds);

        Assert.Equal([alice.Id, bob.Id], summaries["Pair task"].OrderBy(id => id));
        Assert.Empty(summaries["Nobody's task"]);
    }

    [Fact]
    public async Task InDashboardOrder_PutsDatedWorkFirstAndUndatedLast()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await UserTasksTestData.SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var now = DateTimeOffset.UtcNow;
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "Undated");
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "Later", now.AddDays(7));
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "Soon", now.AddDays(1));

        var ordered = await dbContext
            .ProjectTasks.InDashboardOrder()
            .SelectUserTaskSummariesFor(alice.Id)
            .ToListAsync();

        Assert.Equal(["Soon", "Later", "Undated"], ordered.Select(t => t.Name));
    }

    [Fact]
    public async Task InDashboardOrder_BreaksTiesOnPriority_ThenRecency()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await UserTasksTestData.SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var due = DateTimeOffset.UtcNow.AddDays(1);
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "low", due, ProjectTaskPriority.LOW);
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "urgent", due, ProjectTaskPriority.URGENT);
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "high", due, ProjectTaskPriority.HIGH);

        var ordered = await dbContext
            .ProjectTasks.InDashboardOrder()
            .SelectUserTaskSummariesFor(alice.Id)
            .ToListAsync();

        Assert.Equal(["urgent", "high", "low"], ordered.Select(t => t.Name));
    }

    [Fact]
    public async Task DueDates_SortAndCompareInSql_ThanksToTheUtcConverter()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await UserTasksTestData.SeedProjectAsync(dbContext, "Alpha", alice.Id);

        // 23:00 on the 1st at +02:00 is 21:00 UTC, so it precedes 22:00 UTC on the same day —
        // even though the offset-bearing *text* sorts the other way. This is the case that made
        // a bare DateTimeOffset unsafe: before UtcDateTimeOffsetConverter, ORDER BY threw
        // outright and the WHERE below compared strings.
        await UserTasksTestData.SeedTaskAsync(
            dbContext, project, todo, "Berlin evening",
            new DateTimeOffset(2026, 7, 1, 23, 0, 0, TimeSpan.FromHours(2))
        );
        await UserTasksTestData.SeedTaskAsync(
            dbContext, project, todo, "UTC evening",
            new DateTimeOffset(2026, 7, 1, 22, 0, 0, TimeSpan.Zero)
        );

        var ordered = await dbContext
            .ProjectTasks.InDashboardOrder()
            .SelectUserTaskSummariesFor(alice.Id)
            .ToListAsync();
        Assert.Equal(["Berlin evening", "UTC evening"], ordered.Select(t => t.Name));

        var cutoff = new DateTimeOffset(2026, 7, 1, 21, 30, 0, TimeSpan.Zero);
        var early = await dbContext
            .ProjectTasks.Where(t => t.DueDate != null && t.DueDate <= cutoff)
            .SelectUserTaskSummariesFor(alice.Id)
            .ToListAsync();
        Assert.Equal(["Berlin evening"], early.Select(t => t.Name));
    }

    [Fact]
    public async Task DueDate_RoundTripsAsTheSameInstant()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await UserTasksTestData.SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var due = new DateTimeOffset(2026, 7, 1, 23, 0, 0, TimeSpan.FromHours(2));
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "Offset", due);
        dbContext.ChangeTracker.Clear();

        var summary = await dbContext.ProjectTasks.SelectUserTaskSummariesFor(alice.Id).SingleAsync();

        // The offset is collapsed on the way in, so it comes back as UTC — the same instant,
        // not the same wall-clock text. Anything else means the converter lost or shifted time.
        Assert.Equal(due.UtcDateTime, summary.DueDate!.Value.UtcDateTime);
        Assert.Equal(TimeSpan.Zero, summary.DueDate!.Value.Offset);
    }

    [Fact]
    public async Task ReturnsEmpty_ForAUserInNoProjects()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var loner = await TestsUtils.SeedUserAsync(dbContext, "loner@example.com");
        var (project, todo, _) = await UserTasksTestData.SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await UserTasksTestData.SeedTaskAsync(dbContext, project, todo, "Alice task");

        Assert.Empty(await dbContext.ProjectTasks.SelectUserTaskSummariesFor(loner.Id).ToListAsync());
    }
}

/// <summary>
/// GET /api/tasks/{id} — the lookup a task's own page is built on. Its whole reason for
/// existing is the project id it does *not* take.
/// </summary>
public class GetUserTaskTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    [Fact]
    public async Task FindsATaskWithoutBeingToldWhichProjectItIsIn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        var result = await ProjectTasksEndpoints.GetUserTask(
            task.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var summary = Assert.IsType<Ok<UserTaskSummary>>(result.Result).Value!;

        // The caller supplies an id and gets back where it lives — which is what lets a task URL
        // survive being filed into another project.
        Assert.Equal("Ship it", summary.Name);
        Assert.Equal(project.Id, summary.ProjectId);
        Assert.Equal("Todo", summary.ColumnName);
    }

    [Fact]
    public async Task ATaskInAProjectTheCallerIsNotInReadsAsNotFound()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (bobs, todo, _) = await SeedProjectAsync(dbContext, "Bob's", bob.Id);
        var task = await SeedTaskAsync(dbContext, bobs, todo, "Private");

        var result = await ProjectTasksEndpoints.GetUserTask(
            task.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        // There is no route projectId for a permission filter to read, so membership inside the
        // query is the authorization — and non-membership must not be distinguishable from
        // non-existence, or this endpoint enumerates task ids.
        Assert.IsType<NotFound<ApiMessageResponse>>(result.Result);
    }

    [Fact]
    public async Task ATrashedTaskIsNotFound()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Deleted");

        await ProjectTasksEndpoints.DeleteTask(
            project.Id,
            task.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        // A link to a task that has since been thrown away has to land somewhere honest.
        var result = await ProjectTasksEndpoints.GetUserTask(
            task.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.IsType<NotFound<ApiMessageResponse>>(result.Result);
    }
}
