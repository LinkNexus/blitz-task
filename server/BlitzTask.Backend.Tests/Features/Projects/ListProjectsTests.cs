using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Tests.Features.Projects;

/// <summary>
/// Covers the handler behind GET /api/projects, not just its projection.
/// <para>
/// The distinction is the whole point of this file: <see cref="ProjectSummariesTests"/> covered
/// <c>SelectProjectSummariesFor</c> and passed, while the endpoint threw on every request,
/// because the ordering the handler adds *around* the projection was the untranslatable part.
/// A projection test cannot catch that — only running the handler can.
/// </para>
/// </summary>
public class ListProjectsTests
{
    private static async Task<List<ProjectSummary>> ListAsync(
        ApplicationDbContext dbContext,
        User user
    )
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;

        var result = await ProjectsEndpoints.ListProjects(
            dbContext,
            context,
            CancellationToken.None
        );

        return result.Value!;
    }

    private static async Task<Project> SeedProjectAsync(
        ApplicationDbContext dbContext,
        string name,
        int ownerId
    )
    {
        var project = new Project
        {
            Name = name,
            Description = $"{name} description",
            CreatedById = ownerId,
        };
        project.Participants.Add(
            new ProjectParticipant { UserId = ownerId, Role = ProjectRole.Owner }
        );
        dbContext.Projects.Add(project);
        await dbContext.SaveChangesAsync();
        return project;
    }

    [Fact]
    public async Task ExecutesAgainstSqlite_WithoutAskingForAnUntranslatableSort()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        Assert.Equal(["Alpha"], (await ListAsync(dbContext, alice)).Select(p => p.Name));
    }

    [Fact]
    public async Task OrdersMostRecentlyUpdatedFirst()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        var older = await SeedProjectAsync(dbContext, "Older", alice.Id);
        var newer = await SeedProjectAsync(dbContext, "Newer", alice.Id);

        // ApplicationDbContext.SaveChangesAsync stamps UpdatedAt itself, and two rows saved back
        // to back land close enough together to make this flaky — write the timestamps directly,
        // below the level that would overwrite them.
        await dbContext.Database.ExecuteSqlAsync(
            $"UPDATE Projects SET UpdatedAt = '2026-01-01 00:00:00' WHERE Id = {older.Id}"
        );
        await dbContext.Database.ExecuteSqlAsync(
            $"UPDATE Projects SET UpdatedAt = '2026-06-01 00:00:00' WHERE Id = {newer.Id}"
        );

        Assert.Equal(
            ["Newer", "Older"],
            (await ListAsync(dbContext, alice)).Select(p => p.Name)
        );
    }

    [Fact]
    public async Task ReturnsOnlyTheCallersProjects()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        await SeedProjectAsync(dbContext, "Alice only", alice.Id);
        await SeedProjectAsync(dbContext, "Bob only", bob.Id);

        Assert.Equal(["Alice only"], (await ListAsync(dbContext, alice)).Select(p => p.Name));
    }

    [Fact]
    public async Task ReturnsEmpty_ForAUserInNoProjects()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var loner = await TestsUtils.SeedUserAsync(dbContext, "loner@example.com");

        Assert.Empty(await ListAsync(dbContext, loner));
    }
}
