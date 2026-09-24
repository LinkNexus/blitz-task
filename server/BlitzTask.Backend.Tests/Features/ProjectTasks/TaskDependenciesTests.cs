using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.ProjectTasks;

/// <summary>
/// "This task is blocked by that one" (L40.6). The edges themselves are a join table; what these
/// pin is the part that cannot live in the UI — a loop has to be refused by the endpoint, at any
/// depth, because the endpoint is reachable without the UI.
/// </summary>
public class TaskDependenciesTests
{
    private static Task<
        Results<
            JsonHttpResult<TaskDependencyLink>,
            NotFound<ApiMessageResponse>,
            Conflict<ApiMessageResponse>
        >
    > BlockAsync(ApplicationDbContext dbContext, int projectId, ProjectTask task, ProjectTask blocker) =>
        TaskDependenciesEndpoints.AddDependency(
            projectId,
            task.Id,
            new AddTaskDependencyRequest(blocker.Id),
            dbContext,
            CancellationToken.None
        );

    private static async Task<(ApplicationDbContext Db, Project Project, ProjectColumn Todo, ProjectColumn Done)> SetupAsync()
    {
        var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        return (dbContext, project, todo, done);
    }

    [Fact]
    public async Task ATaskCanBeBlockedByAnother()
    {
        var (dbContext, project, todo, _) = await SetupAsync();
        using var _db = dbContext;
        var api = await SeedTaskAsync(dbContext, project, todo, "Ship the API");
        var ui = await SeedTaskAsync(dbContext, project, todo, "Build the UI");

        var result = await BlockAsync(dbContext, project.Id, ui, api);

        var created = Assert.IsType<JsonHttpResult<TaskDependencyLink>>(result.Result);
        Assert.Equal("Ship the API", created.Value!.Name);
        Assert.Equal(todo.Id, created.Value.ColumnId);

        var edge = await dbContext.ProjectTaskDependencies.SingleAsync();
        Assert.Equal(ui.Id, edge.DependentTaskId);
        Assert.Equal(api.Id, edge.DependsOnTaskId);
    }

    [Fact]
    public async Task ATaskCannotBlockItself()
    {
        var (dbContext, project, todo, _) = await SetupAsync();
        using var _db = dbContext;
        var task = await SeedTaskAsync(dbContext, project, todo, "Alone");

        var result = await BlockAsync(dbContext, project.Id, task, task);

        Assert.IsType<Conflict<ApiMessageResponse>>(result.Result);
        Assert.False(await dbContext.ProjectTaskDependencies.AnyAsync());
    }

    [Fact]
    public async Task TheSameBlockerCannotBeAddedTwice()
    {
        var (dbContext, project, todo, _) = await SetupAsync();
        using var _db = dbContext;
        var api = await SeedTaskAsync(dbContext, project, todo, "Ship the API");
        var ui = await SeedTaskAsync(dbContext, project, todo, "Build the UI");

        await BlockAsync(dbContext, project.Id, ui, api);
        var again = await BlockAsync(dbContext, project.Id, ui, api);

        Assert.IsType<Conflict<ApiMessageResponse>>(again.Result);
        Assert.Equal(1, await dbContext.ProjectTaskDependencies.CountAsync());
    }

    [Fact]
    public async Task ADirectLoopIsRefused()
    {
        var (dbContext, project, todo, _) = await SetupAsync();
        using var _db = dbContext;
        var a = await SeedTaskAsync(dbContext, project, todo, "A");
        var b = await SeedTaskAsync(dbContext, project, todo, "B");

        await BlockAsync(dbContext, project.Id, a, b);
        var loop = await BlockAsync(dbContext, project.Id, b, a);

        Assert.IsType<Conflict<ApiMessageResponse>>(loop.Result);
        Assert.Equal(1, await dbContext.ProjectTaskDependencies.CountAsync());
    }

    [Fact]
    public async Task ALoopIsRefusedAtAnyDepth()
    {
        var (dbContext, project, todo, _) = await SetupAsync();
        using var _db = dbContext;
        var a = await SeedTaskAsync(dbContext, project, todo, "A");
        var b = await SeedTaskAsync(dbContext, project, todo, "B");
        var c = await SeedTaskAsync(dbContext, project, todo, "C");
        var d = await SeedTaskAsync(dbContext, project, todo, "D");

        // A <- B <- C <- D, then try to make A wait on D.
        await BlockAsync(dbContext, project.Id, a, b);
        await BlockAsync(dbContext, project.Id, b, c);
        await BlockAsync(dbContext, project.Id, c, d);

        var loop = await BlockAsync(dbContext, project.Id, d, a);

        // The whole reason this is walked server-side: one hop is easy to spot in a UI, four is
        // not, and the endpoint is reachable without the UI either way.
        Assert.IsType<Conflict<ApiMessageResponse>>(loop.Result);
        Assert.Equal(3, await dbContext.ProjectTaskDependencies.CountAsync());
    }

    [Fact]
    public async Task ADiamondIsNotALoop()
    {
        var (dbContext, project, todo, _) = await SetupAsync();
        using var _db = dbContext;
        var top = await SeedTaskAsync(dbContext, project, todo, "Top");
        var left = await SeedTaskAsync(dbContext, project, todo, "Left");
        var right = await SeedTaskAsync(dbContext, project, todo, "Right");
        var bottom = await SeedTaskAsync(dbContext, project, todo, "Bottom");

        await BlockAsync(dbContext, project.Id, top, left);
        await BlockAsync(dbContext, project.Id, top, right);
        await BlockAsync(dbContext, project.Id, left, bottom);

        // Two paths reach `bottom`; the walk visits it twice and must not call that a cycle.
        var result = await BlockAsync(dbContext, project.Id, right, bottom);

        Assert.IsType<JsonHttpResult<TaskDependencyLink>>(result.Result);
        Assert.Equal(4, await dbContext.ProjectTaskDependencies.CountAsync());
    }

    [Fact]
    public async Task ATaskFromAnotherProjectCannotBeABlocker()
    {
        var (dbContext, alpha, alphaTodo, _) = await SetupAsync();
        using var _db = dbContext;
        var (beta, betaTodo, _) = await SeedProjectAsync(dbContext, "Beta", 1);
        var mine = await SeedTaskAsync(dbContext, alpha, alphaTodo, "Mine");
        var theirs = await SeedTaskAsync(dbContext, beta, betaTodo, "Theirs");

        var result = await BlockAsync(dbContext, alpha.Id, mine, theirs);

        // A cross-project edge would render a task title to someone who cannot open the project
        // it lives in — the one RBAC boundary this app has.
        Assert.IsType<NotFound<ApiMessageResponse>>(result.Result);
        Assert.False(await dbContext.ProjectTaskDependencies.AnyAsync());
    }

    [Fact]
    public async Task RemovingADependencyLeavesBothTasks()
    {
        var (dbContext, project, todo, _) = await SetupAsync();
        using var _db = dbContext;
        var api = await SeedTaskAsync(dbContext, project, todo, "Ship the API");
        var ui = await SeedTaskAsync(dbContext, project, todo, "Build the UI");
        await BlockAsync(dbContext, project.Id, ui, api);

        var result = await TaskDependenciesEndpoints.RemoveDependency(
            project.Id,
            ui.Id,
            api.Id,
            dbContext,
            CancellationToken.None
        );

        Assert.IsType<NoContent>(result.Result);
        Assert.False(await dbContext.ProjectTaskDependencies.AnyAsync());
        Assert.Equal(2, await dbContext.ProjectTasks.CountAsync());
    }

    [Fact]
    public async Task ATrashedBlockerStopsBlocking()
    {
        var (dbContext, project, todo, _) = await SetupAsync();
        using var _db = dbContext;
        var api = await SeedTaskAsync(dbContext, project, todo, "Ship the API");
        var ui = await SeedTaskAsync(dbContext, project, todo, "Build the UI");
        await BlockAsync(dbContext, project.Id, ui, api);

        api.DeletedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();

        var details = await dbContext
            .ProjectTasks.Where(t => t.Id == ui.Id)
            .Include(t => t.BlockedBy)
            .ThenInclude(d => d.DependsOnTask)
            .SingleAsync();

        // Falls out of the soft-delete query filter rather than being handled: a task in the
        // trash cannot be completed, so treating it as a live blocker would be wrong. The edge
        // itself survives, so restoring the blocker restores the block.
        Assert.DoesNotContain(details.BlockedBy, d => d.DependsOnTask is not null);
        Assert.Equal(1, await dbContext.ProjectTaskDependencies.CountAsync());
    }
}
