using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Tests.Features.Projects;

/// <summary>
/// Covers the projection behind GET /api/projects. Runs against real SQLite rather than the
/// in-memory provider: the interesting risk is whether EF can translate the per-user role
/// subquery, and the in-memory provider would happily evaluate it client-side and pass.
/// </summary>
public class ProjectSummariesTests
{
    private static async Task<Project> SeedProjectAsync(
        ApplicationDbContext dbContext,
        string name,
        int ownerId,
        params (int UserId, ProjectRole Role)[] others
    )
    {
        var project = new Project
        {
            Name = name,
            Description = $"{name} description",
            CreatedById = ownerId,
            Tags = ["alpha", "beta"],
        };
        project.Participants.Add(
            new ProjectParticipant { UserId = ownerId, Role = ProjectRole.Owner }
        );
        foreach (var (userId, role) in others)
        {
            project.Participants.Add(new ProjectParticipant { UserId = userId, Role = role });
        }

        dbContext.Projects.Add(project);
        await dbContext.SaveChangesAsync();
        return project;
    }

    private static async Task AddTasksAsync(
        ApplicationDbContext dbContext,
        Project project,
        int count
    )
    {
        var column = new ProjectColumn
        {
            Name = "Backlog",
            Color = "#FF0000",
            Score = 1000,
            ProjectId = project.Id,
        };
        dbContext.ProjectColumns.Add(column);
        await dbContext.SaveChangesAsync();

        for (var i = 0; i < count; i++)
        {
            dbContext.ProjectTasks.Add(
                new ProjectTask
                {
                    Name = $"Task {i}",
                    Description = "",
                    Score = 1000 + i,
                    RelatedColumnId = column.Id,
                    RelatedProjectId = project.Id,
                }
            );
        }
        await dbContext.SaveChangesAsync();
    }

    [Fact]
    public async Task ReturnsOnlyProjectsTheUserParticipatesIn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");

        await SeedProjectAsync(dbContext, "Alice only", alice.Id);
        await SeedProjectAsync(dbContext, "Bob only", bob.Id);
        await SeedProjectAsync(dbContext, "Shared", alice.Id, (bob.Id, ProjectRole.Viewer));

        var forAlice = await dbContext
            .Projects.SelectProjectSummariesFor(alice.Id)
            .ToListAsync();

        Assert.Equal(
            ["Alice only", "Shared"],
            forAlice.Select(p => p.Name).OrderBy(n => n)
        );
    }

    [Fact]
    public async Task RoleIsTheRequestingUsersRole_NotSomeoneElses()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");

        await SeedProjectAsync(dbContext, "Shared", alice.Id, (bob.Id, ProjectRole.Contributor));

        var forAlice = await dbContext.Projects.SelectProjectSummariesFor(alice.Id).SingleAsync();
        var forBob = await dbContext.Projects.SelectProjectSummariesFor(bob.Id).SingleAsync();

        Assert.Equal(ProjectRole.Owner, forAlice.Role);
        Assert.Equal(ProjectRole.Contributor, forBob.Role);
    }

    [Fact]
    public async Task CountsParticipantsAndTasks()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");

        var project = await SeedProjectAsync(
            dbContext,
            "Shared",
            alice.Id,
            (bob.Id, ProjectRole.Viewer)
        );
        await AddTasksAsync(dbContext, project, 3);

        var summary = await dbContext.Projects.SelectProjectSummariesFor(alice.Id).SingleAsync();

        Assert.Equal(2, summary.ParticipantsCount);
        Assert.Equal(3, summary.TasksCount);
    }

    [Fact]
    public async Task ReturnsEmpty_ForAUserInNoProjects()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var loner = await TestsUtils.SeedUserAsync(dbContext, "loner@example.com");
        await SeedProjectAsync(dbContext, "Alice only", alice.Id);

        Assert.Empty(await dbContext.Projects.SelectProjectSummariesFor(loner.Id).ToListAsync());
    }

    [Fact]
    public async Task CarriesTheListRowFields()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var summary = await dbContext.Projects.SelectProjectSummariesFor(alice.Id).SingleAsync();

        Assert.Equal("Alpha", summary.Name);
        Assert.Equal("Alpha description", summary.Description);
        // Tags round-trip through a value converter, so they are worth asserting explicitly.
        Assert.Equal(["alpha", "beta"], summary.Tags);
        Assert.NotEqual(default, summary.UpdatedAt);
    }
}
