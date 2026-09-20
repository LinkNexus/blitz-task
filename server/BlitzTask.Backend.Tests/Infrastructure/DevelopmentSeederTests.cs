using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Moq;

namespace BlitzTask.Backend.Tests.Infrastructure;

/// <summary>
/// The seeder. What is worth pinning is not that it inserts rows — it is that running it twice
/// is harmless and that it cannot run where it would hurt.
/// </summary>
public class DevelopmentSeederTests
{
    private static IHostEnvironment Environment(string name)
    {
        var env = new Mock<IHostEnvironment>();
        env.SetupGet(e => e.EnvironmentName).Returns(name);
        return env.Object;
    }

    [Fact]
    public async Task SeedsAProjectThatExercisesTheApp()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();

        await DevelopmentSeeder.RunAsync(dbContext, Environment("Development"));

        var project = await dbContext
            .Projects.Include(p => p.Columns)
            .Include(p => p.Participants)
            .SingleAsync(p => !p.IsInbox);

        Assert.Equal(4, project.Columns.Count);
        Assert.Equal(3, project.Participants.Count);

        var tasks = await dbContext.ProjectTasks.Where(t => t.RelatedProjectId == project.Id).ToListAsync();

        // One task per state the app treats differently — that is the point of the fixture.
        Assert.Equal(6, tasks.Count);
        Assert.Contains(tasks, t => t.DueDate < DateTimeOffset.UtcNow);
        Assert.Contains(tasks, t => t.DueDate is null);
        Assert.True(await dbContext.TaskRecurrences.AnyAsync());
        Assert.True(await dbContext.TaskChecklistItems.AnyAsync());

        // A thread with a mention, so notifications and permalinks have something to point at.
        var comments = await dbContext.TaskComments.ToListAsync();
        Assert.Equal(2, comments.Count);
        Assert.Contains(comments, c => c.Body.Contains("@Ada Lovelace"));
    }

    [Fact]
    public async Task CreatesTheInboxThroughItsOwnHandler()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();

        await DevelopmentSeeder.RunAsync(dbContext, Environment("Development"));

        var inbox = await dbContext
            .Projects.Include(p => p.Columns)
            .SingleAsync(p => p.IsInbox);

        // Two columns, because "done" is a position here and a one-column Inbox holds captures
        // that can never be completed (L24). The seeder gets that by calling the real handler
        // rather than by knowing it.
        Assert.Equal(2, inbox.Columns.Count);
        Assert.True(await dbContext.ProjectTasks.AnyAsync(t => t.RelatedProjectId == inbox.Id));
    }

    [Fact]
    public async Task RunningItTwiceChangesNothing()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();

        await DevelopmentSeeder.RunAsync(dbContext, Environment("Development"));

        var before = (
            Users: await dbContext.Users.CountAsync(),
            Projects: await dbContext.Projects.CountAsync(),
            Tasks: await dbContext.ProjectTasks.CountAsync(),
            Comments: await dbContext.TaskComments.CountAsync()
        );

        var message = await DevelopmentSeeder.RunAsync(dbContext, Environment("Development"));

        var after = (
            Users: await dbContext.Users.CountAsync(),
            Projects: await dbContext.Projects.CountAsync(),
            Tasks: await dbContext.ProjectTasks.CountAsync(),
            Comments: await dbContext.TaskComments.CountAsync()
        );

        // Idempotent by identity rather than by a guard: the fixtures are looked up by email and
        // name, so a second run finds them instead of minting a second set.
        Assert.Equal(before, after);
        Assert.Contains("Already seeded", message);
    }

    [Fact]
    public async Task LeavesWorkThatWasAlreadyThereAlone()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();

        var mine = await TestsUtils.SeedUserAsync(dbContext, "me@example.com");
        var myProject = new Project
        {
            Name = "My real project",
            Description = "",
            CreatedById = mine.Id,
        };
        dbContext.Projects.Add(myProject);
        await dbContext.SaveChangesAsync();

        await DevelopmentSeeder.RunAsync(dbContext, Environment("Development"));

        // There is no destructive path at all — not a guarded one. Fixtures land beside real
        // work rather than replacing it, which is why no --reset flag exists to be typed at the
        // wrong database.
        Assert.True(await dbContext.Projects.AnyAsync(p => p.Name == "My real project"));
        Assert.True(await dbContext.Users.AnyAsync(u => u.Email == "me@example.com"));
    }

    [Fact]
    public async Task RefusesToRunInProduction()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();

        var message = await DevelopmentSeeder.RunAsync(dbContext, Environment("Production"));

        Assert.Contains("Refusing", message);
        Assert.Empty(await dbContext.Users.ToListAsync());
    }
}
