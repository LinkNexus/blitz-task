using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Tests.Features.Projects;

/// <summary>
/// The board a new account opens onto (L48).
/// <para>
/// What is worth asserting here is not the copy — that will be rewritten — but the handful of
/// structural promises the cards make. Each one is an instruction a user will follow within a
/// minute of arriving, so a board that cannot honour it is worse than no board at all: a card
/// saying "drag me to Done" on a project with no last column teaches the wrong thing about the
/// one idea the app is built on.
/// </para>
/// </summary>
public class WelcomeProjectTests
{
    private static async Task<User> SeedUserAsync(ApplicationDbContext dbContext)
    {
        var user = new User
        {
            Name = "New Person",
            Email = "new@example.com",
            EmailConfirmed = true,
            Password = "hashed",
        };

        dbContext.Users.Add(user);
        WelcomeProject.AddFor(user, dbContext);
        await dbContext.SaveChangesAsync();

        return user;
    }

    private static Task<Project> LoadAsync(ApplicationDbContext dbContext) =>
        dbContext
            .Projects.Include(p => p.Columns)
            .ThenInclude(c => c.Tasks)
            .ThenInclude(t => t.ChecklistItems)
            .Include(p => p.Participants)
            .SingleAsync(p => !p.IsInbox);

    [Fact]
    public async Task ARegisteringUserGetsOneProjectTheyOwn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var user = await SeedUserAsync(dbContext);

        var project = await LoadAsync(dbContext);

        Assert.Equal(user.Id, project.CreatedById);
        Assert.Equal(ProjectRole.Owner, project.Participants.Single().Role);
        // Ordinary in every respect: no flag to branch on, so nothing in the app can treat it
        // specially and the delete path needs no exception for it.
        Assert.False(project.IsInbox);
    }

    [Fact]
    public async Task ItHasALastColumnForTheFirstCardToBeDraggedInto()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        await SeedUserAsync(dbContext);

        var project = await LoadAsync(dbContext);
        var columns = project.Columns.OrderBy(c => c.Score).ToList();

        // Completion is a position, not a flag. Three columns, and the highest-score one must be
        // empty of nothing in particular — it only has to exist, or "drag me to Done" is a lie
        // and every task in the project counts as open forever.
        Assert.Equal(3, columns.Count);
        Assert.Equal("Done", columns[^1].Name);
        Assert.Distinct(columns.Select(c => c.Score));
    }

    [Fact]
    public async Task EveryTaskIsWiredToBothItsColumnAndItsProject()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        await SeedUserAsync(dbContext);

        var project = await LoadAsync(dbContext);
        var tasks = project.Columns.SelectMany(c => c.Tasks).ToList();

        Assert.NotEmpty(tasks);
        // `RelatedProjectId` is a second foreign key the column relationship says nothing about.
        // Left to EF's fixup it is written as zero, which SQLite rejects outright — so this
        // passing at all is the evidence that the save went through against a real provider.
        Assert.All(tasks, task => Assert.Equal(project.Id, task.RelatedProjectId));
        Assert.All(tasks, task => Assert.NotEqual(0, task.RelatedColumnId));
    }

    [Fact]
    public async Task TheCardsAreOrderedSoTheFirstStepRendersFirst()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        await SeedUserAsync(dbContext);

        var project = await LoadAsync(dbContext);
        var firstColumn = project.Columns.OrderBy(c => c.Score).First();
        var rendered = firstColumn.Tasks.OrderByDescending(t => t.Score).ToList();

        // Tasks render highest score first, so a tour whose steps are in the wrong order is a
        // tour that reads backwards. The drag instruction has to be the card at the top.
        Assert.StartsWith("Drag me", rendered[0].Name);
        Assert.Distinct(rendered.Select(t => t.Score));
    }

    [Fact]
    public async Task TheChecklistCardActuallyCarriesAChecklist()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        await SeedUserAsync(dbContext);

        var project = await LoadAsync(dbContext);
        var withChecklist = project
            .Columns.SelectMany(c => c.Tasks)
            .Single(t => t.ChecklistItems.Count > 0);

        // The card explains checklists. If the projection or the insert drops them it is a card
        // describing something that is not there, which is the one failure mode a tour cannot
        // survive.
        Assert.All(withChecklist.ChecklistItems, item => Assert.False(item.IsDone));
        Assert.Distinct(withChecklist.ChecklistItems.Select(i => i.Position));
    }

    [Fact]
    public async Task ADeadlineCardIsDueInTheFutureAndCarriesNoInventedTimeOfDay()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        await SeedUserAsync(dbContext);

        var project = await LoadAsync(dbContext);
        var dated = project.Columns.SelectMany(c => c.Tasks).Single(t => t.DueDate is not null);

        // An onboarding card that arrives already overdue teaches that the app is behind on its
        // own tour.
        Assert.True(dated.DueDate > DateTimeOffset.UtcNow);
        // `HasDueTime` false is what makes it render as a day rather than claiming a deadline of
        // whatever midnight the seed happened to run at.
        Assert.False(dated.HasDueTime);
    }

    [Fact]
    public async Task ItIsNotCreatedAgainForAnAccountThatAlreadyHasOne()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var user = await SeedUserAsync(dbContext);

        // Deleting it must be final — the whole reason it is written in the registration
        // transaction rather than fetched-or-created on first load. Nothing re-runs `AddFor`, so
        // the only way back is the trash, like any other project.
        var project = await LoadAsync(dbContext);
        project.DeletedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        Assert.False(
            await dbContext.Projects.AnyAsync(p => !p.IsInbox && p.CreatedById == user.Id)
        );
    }
}
