using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectSections;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using Microsoft.AspNetCore.Http.HttpResults;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.ProjectSections;

/// <summary>
/// Sections (L40.5 step 1) — a second axis to read a board along, crossing its columns. What
/// these pin is that it stays an <i>extra</i> axis: a task never needs one, and removing one
/// never removes work.
/// </summary>
public class ProjectSectionsTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static async Task<ProjectSection> SeedSectionAsync(
        ApplicationDbContext dbContext,
        Project project,
        string name,
        float score = 0
    )
    {
        var section = new ProjectSection
        {
            ProjectId = project.Id,
            Name = name,
            Color = "#6366F1",
            Score = score,
        };
        dbContext.ProjectSections.Add(section);
        await dbContext.SaveChangesAsync();
        return section;
    }

    private static Task CreateTaskAsync(
        ApplicationDbContext dbContext,
        User user,
        Project project,
        ProjectColumn column,
        string name,
        int? sectionId
    ) =>
        ProjectTasksEndpoints.CreateTask(
            project.Id,
            column.Id,
            new CreateProjectTaskRequest
            {
                Name = name,
                Description = "",
                Priority = ProjectTaskPriority.MEDIUM,
                SectionId = sectionId,
            },
            dbContext,
            ContextFor(user),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

    [Fact]
    public async Task DeletingASectionKeepsItsTasksAndUnsectionsThem()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var frontend = await SeedSectionAsync(dbContext, project, "frontend");

        await CreateTaskAsync(dbContext, alice, project, todo, "Style the header", frontend.Id);
        await CreateTaskAsync(dbContext, alice, project, todo, "Unsectioned", null);

        await ProjectSectionsEndpoints.DeleteSection(
            project.Id,
            frontend.Id,
            dbContext,
            CancellationToken.None
        );

        // Removing a section says "stop splitting the board this way", never "throw this work
        // away" — which is also why it is not soft-deletable: there is nothing to restore.
        var tasks = await dbContext.ProjectTasks.ToListAsync();
        Assert.Equal(2, tasks.Count);
        Assert.All(tasks, t => Assert.Null(t.SectionId));
        Assert.False(await dbContext.ProjectSections.AnyAsync());
    }

    [Fact]
    public async Task ASectionFromAnotherProjectIsDroppedRatherThanSaved()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (alpha, alphaTodo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var (beta, _, _) = await SeedProjectAsync(dbContext, "Beta", alice.Id);
        var foreign = await SeedSectionAsync(dbContext, beta, "theirs");

        await CreateTaskAsync(dbContext, alice, alpha, alphaTodo, "Mine", foreign.Id);

        // Same call FileTask makes about non-participant assignees: the id means nothing here,
        // and failing the whole save over a stale one loses the edit actually being made.
        var task = await dbContext.ProjectTasks.SingleAsync();
        Assert.Null(task.SectionId);
    }

    [Fact]
    public async Task UpdatingASectionRenamesAndRecoloursIt()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var section = await SeedSectionAsync(dbContext, project, "frontend");

        await ProjectSectionsEndpoints.UpdateSection(
            project.Id,
            section.Id,
            new UpdateProjectSectionRequest("  Frontend  ", "#FF0000", 500),
            dbContext,
            CancellationToken.None
        );

        Assert.Equal("Frontend", section.Name);
        Assert.Equal("#FF0000", section.Color);
        Assert.Equal(500, section.Score);
    }

    [Fact]
    public async Task ASectionOfAnotherProjectCannotBeDeletedThroughThisOne()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (alpha, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var (beta, _, _) = await SeedProjectAsync(dbContext, "Beta", alice.Id);
        var theirs = await SeedSectionAsync(dbContext, beta, "theirs");

        var result = await ProjectSectionsEndpoints.DeleteSection(
            alpha.Id,
            theirs.Id,
            dbContext,
            CancellationToken.None
        );

        Assert.IsType<NotFound<ApiMessageResponse>>(result.Result);
        Assert.True(await dbContext.ProjectSections.AnyAsync(s => s.Id == theirs.Id));
    }
}
