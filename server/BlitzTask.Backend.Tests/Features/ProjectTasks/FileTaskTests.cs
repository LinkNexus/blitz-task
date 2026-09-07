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
/// PATCH /api/tasks/{id}/project — the way a capture leaves the Inbox. Two projects have to be
/// authorised rather than one, which is why this cannot use RequireProjectPermissionFilter and
/// why the checks are worth pinning: getting either side wrong moves other people's work.
/// </summary>
public class FileTaskTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static Task<IResult> FileAsync(
        ApplicationDbContext dbContext,
        User user,
        int taskId,
        int projectId,
        int? columnId = null
    ) =>
        ProjectTasksEndpoints.FileTask(
            taskId,
            new FileTaskRequest(projectId, columnId),
            dbContext,
            ContextFor(user),
            CancellationToken.None
        );

    [Fact]
    public async Task MovesTheTaskToTheTargetsFirstColumnByDefault()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (inbox, captured, _) = await SeedProjectAsync(dbContext, "Inbox", alice.Id);
        var (target, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, inbox, captured, "Buy milk");

        var result = await FileAsync(dbContext, alice, task.Id, target.Id);

        var summary = Assert.IsType<Ok<UserTaskSummary>>(result).Value!;
        Assert.Equal(target.Id, summary.ProjectId);
        Assert.Equal(todo.Id, summary.ColumnId);
    }

    [Fact]
    public async Task HonoursAnExplicitColumn_AndAppendsAboveWhatIsAlreadyThere()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (inbox, captured, _) = await SeedProjectAsync(dbContext, "Inbox", alice.Id);
        var (target, _, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var sitting = await SeedTaskAsync(dbContext, target, done, "Already there");
        var task = await SeedTaskAsync(dbContext, inbox, captured, "Buy milk");

        await FileAsync(dbContext, alice, task.Id, target.Id, done.Id);

        var filed = await dbContext.ProjectTasks.SingleAsync(t => t.Id == task.Id);
        Assert.Equal(done.Id, filed.RelatedColumnId);
        // Tasks render highest score first, so a filed task lands on top — the same place a
        // newly created one goes.
        Assert.True(filed.Score > sitting.Score);
    }

    [Fact]
    public async Task DropsAssigneesWhoAreNotInTheTargetProject()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (source, todo, _) = await SeedProjectAsync(
            dbContext,
            "Source",
            alice.Id,
            (bob.Id, ProjectRole.Collaborator)
        );
        var (target, _, _) = await SeedProjectAsync(dbContext, "Target", alice.Id);
        var task = await SeedTaskAsync(
            dbContext,
            source,
            todo,
            "Shared work",
            assignees: [alice, bob]
        );

        await FileAsync(dbContext, alice, task.Id, target.Id);

        var filed = await dbContext
            .ProjectTasks.Include(t => t.Assignees)
            .SingleAsync(t => t.Id == task.Id);

        // Bob cannot see the target project, so keeping him assigned would leave the task on his
        // "assigned to me" list and on nobody's board.
        Assert.Equal([alice.Id], filed.Assignees.Select(a => a.Id));
    }

    [Fact]
    public async Task ATargetTheCallerIsNotInReadsAsNotFound()
    {
        // Same shape as RequireProjectPermissionFilter: non-membership must not be
        // distinguishable from non-existence, or this endpoint enumerates project ids.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (inbox, captured, _) = await SeedProjectAsync(dbContext, "Inbox", alice.Id);
        var (bobsProject, _, _) = await SeedProjectAsync(dbContext, "Bob's", bob.Id);
        var task = await SeedTaskAsync(dbContext, inbox, captured, "Buy milk");

        var result = await FileAsync(dbContext, alice, task.Id, bobsProject.Id);

        Assert.IsType<NotFound<ApiMessageResponse>>(result);
        var untouched = await dbContext.ProjectTasks.SingleAsync(t => t.Id == task.Id);
        Assert.Equal(inbox.Id, untouched.RelatedProjectId);
    }

    [Fact]
    public async Task AViewerOnTheTargetCannotFileIntoIt()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (inbox, captured, _) = await SeedProjectAsync(dbContext, "Inbox", alice.Id);
        var (readOnly, _, _) = await SeedProjectAsync(
            dbContext,
            "Read only",
            bob.Id,
            (alice.Id, ProjectRole.Viewer)
        );
        var task = await SeedTaskAsync(dbContext, inbox, captured, "Buy milk");

        var result = await FileAsync(dbContext, alice, task.Id, readOnly.Id);

        var json = Assert.IsType<JsonHttpResult<ApiMessageResponse>>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, json.StatusCode);
    }
}
