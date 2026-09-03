using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using Microsoft.EntityFrameworkCore;

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

        var ordered = (await dbContext.ProjectTasks.SelectUserTaskSummariesFor(alice.Id).ToListAsync())
            .InDashboardOrder();

        Assert.Equal(["Soon", "Later", "Undated"], ordered.Select(t => t.Name));
    }

    [Fact]
    public void InDashboardOrder_BreaksTiesOnPriority_ThenRecency()
    {
        var older = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var newer = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);

        UserTaskSummary Row(string name, ProjectTaskPriority priority, DateTime updatedAt) =>
            new(0, name, "", priority, [], null, null, older, updatedAt, [], 1, "P", 1, "C", "#fff", false);

        var ordered = new[]
        {
            Row("low/new", ProjectTaskPriority.LOW, newer),
            Row("urgent/old", ProjectTaskPriority.URGENT, older),
            Row("urgent/new", ProjectTaskPriority.URGENT, newer),
        }.InDashboardOrder();

        Assert.Equal(["urgent/new", "urgent/old", "low/new"], ordered.Select(t => t.Name));
    }

    [Fact]
    public async Task SelectUserTaskSummariesFor_OrdersByDueDateOnlyInMemory()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        // Guards the reason InDashboardOrder is an IEnumerable extension: pushing the same sort
        // into SQL does not degrade, it throws outright. If a future EF/SQLite version starts
        // translating this, the ordering can move back into the query — see ROADMAP L50.
        await Assert.ThrowsAsync<NotSupportedException>(() =>
            dbContext
                .ProjectTasks.OrderBy(t => t.DueDate)
                .SelectUserTaskSummariesFor(alice.Id)
                .ToListAsync()
        );
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
