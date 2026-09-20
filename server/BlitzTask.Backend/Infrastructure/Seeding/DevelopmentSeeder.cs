using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.TaskComments;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Infrastructure.Seeding;

/// <summary>
/// Fills an empty development database with a project that looks like one somebody uses.
/// <para>
/// Written because every manual check of a feature started by hand-assembling that state with
/// <c>sqlite3</c> inserts — slow, easy to get subtly wrong, and a different shape every time, so
/// two runs were never comparing the same thing.
/// </para>
/// <para>
/// <b>It has no destructive path at all.</b> Not "guarded against deleting", but incapable of
/// it: every fixture is looked up by a stable identity and created only if missing, so running
/// it twice is a no-op and running it against a database that already has real work in it adds
/// fixtures beside that work rather than replacing anything. A <c>--reset</c> would have been
/// the obvious companion and is exactly the flag that eventually gets typed against the wrong
/// database. The environment check below is the second belt, not the first.
/// </para>
/// </summary>
public static class DevelopmentSeeder
{
    /// <summary>The one password every fixture account shares. It is written in the source of a
    /// seeding tool, which is the whole point — these accounts exist to be logged into.</summary>
    public const string Password = "Fixture123!";

    private const string ProjectName = "Fixtures";

    private record Person(string Email, string Name);

    private static readonly Person Ada = new("ada@fixtures.test", "Ada Lovelace");
    private static readonly Person Grace = new("grace@fixtures.test", "Grace Hopper");
    private static readonly Person Linus = new("linus@fixtures.test", "Linus Torvalds");

    public static async Task<string> RunAsync(
        ApplicationDbContext dbContext,
        IHostEnvironment environment,
        CancellationToken cancellationToken = default
    )
    {
        // A seeder that can run in Production is a seeder that eventually does. Refusing by
        // environment costs nothing and removes the only scenario anyone would regret.
        if (environment.IsProduction())
        {
            // Worth spelling out: ASP.NET defaults to Production when ASPNETCORE_ENVIRONMENT is
            // unset, which is what a bare `dotnet BlitzTask.Backend.dll` gets. `dotnet run`
            // picks up Development from launchSettings, so the documented command works — but
            // anyone reaching for the published binary deserves to be told why nothing happened.
            return """
                Refusing to seed: the environment is Production (ASPNETCORE_ENVIRONMENT is
                unset or set to Production, and unset defaults to Production).

                For a development database, either use the documented command:
                  dotnet run --project server/BlitzTask.Backend -- --seed
                or set the environment explicitly:
                  ASPNETCORE_ENVIRONMENT=Development dotnet BlitzTask.Backend.dll --seed
                """;
        }

        var ada = await EnsureUserAsync(dbContext, Ada, cancellationToken);
        var grace = await EnsureUserAsync(dbContext, Grace, cancellationToken);
        var linus = await EnsureUserAsync(dbContext, Linus, cancellationToken);

        var existing = await dbContext
            .Projects.Include(p => p.Columns)
            .FirstOrDefaultAsync(
                p => p.Name == ProjectName && p.CreatedById == ada.Id,
                cancellationToken
            );

        if (existing is not null)
            return $"Already seeded — “{ProjectName}” exists (project {existing.Id}). Nothing changed.";

        var project = new Project
        {
            Name = ProjectName,
            Description = "A project with enough in it to exercise the app.",
            CreatedById = ada.Id,
            Tags = ["fixtures"],
            StartDate = DateTimeOffset.UtcNow.AddDays(-30),
            // The same columns a real project is created with, rather than a second opinion.
            Columns = [.. ProjectsEndpoints.CreateDefaultColumns()],
        };

        project.Participants.Add(new ProjectParticipant { UserId = ada.Id, Role = ProjectRole.Owner });
        project.Participants.Add(
            new ProjectParticipant { UserId = grace.Id, Role = ProjectRole.Collaborator }
        );
        project.Participants.Add(
            new ProjectParticipant { UserId = linus.Id, Role = ProjectRole.Contributor }
        );

        dbContext.Projects.Add(project);
        await dbContext.SaveChangesAsync(cancellationToken);

        var columns = project.Columns.OrderBy(c => c.Score).ToList();
        var backlog = columns[0];
        var inProgress = columns[1];
        var done = columns[^1];

        var today = DateTimeOffset.UtcNow;

        // One task per state the app treats differently, because those are the states worth
        // looking at: overdue, due today, upcoming, undated, completed, recurring.
        var overdue = Task(backlog, "Renew the domain", today.AddDays(-3), ProjectTaskPriority.URGENT, grace);
        var dueToday = Task(inProgress, "Write the changelog", today, ProjectTaskPriority.HIGH, ada);
        var upcoming = Task(backlog, "Plan the migration", today.AddDays(7), ProjectTaskPriority.MEDIUM, ada, grace);
        var undated = Task(backlog, "Tidy the README", null, ProjectTaskPriority.LOW);
        var completed = Task(done, "Ship the command palette", today.AddDays(-1), ProjectTaskPriority.MEDIUM, ada);
        var recurring = Task(inProgress, "Team sync", today.AddDays(2), ProjectTaskPriority.LOW, ada, grace, linus);

        recurring.Recurrence = new TaskRecurrence
        {
            Frequency = RecurrenceFrequency.WEEKLY,
            Interval = 1,
            Weekdays = [(int)today.DayOfWeek],
        };

        upcoming.ChecklistItems =
        [
            new TaskChecklistItem { Text = "Inventory the tables", IsDone = true, Position = 0 },
            new TaskChecklistItem { Text = "Write the migration", Position = 1 },
            new TaskChecklistItem { Text = "Rehearse the rollback", Position = 2 },
        ];

        dbContext.ProjectTasks.AddRange(
            overdue,
            dueToday,
            upcoming,
            undated,
            completed,
            recurring
        );
        await dbContext.SaveChangesAsync(cancellationToken);

        // A thread with a mention in it, so notifications, @mentions and permalinks all have
        // something real to point at the moment the app starts.
        dbContext.TaskComments.AddRange(
            new TaskComment
            {
                ProjectTaskId = upcoming.Id,
                AuthorId = grace.Id,
                Body = "Do we need a maintenance window for this?",
            },
            new TaskComment
            {
                ProjectTaskId = upcoming.Id,
                AuthorId = linus.Id,
                Body = $"@{Ada.Name} thinks an hour is plenty. I would take two.",
            }
        );

        await dbContext.SaveChangesAsync(cancellationToken);

        // Through the real handler rather than by hand: the Inbox is a project with a flag, two
        // columns and a participant row, and every one of those is a rule that lives in
        // InboxEndpoints. A seeder with its own copy would be the thing that drifts.
        var inboxContext = new DefaultHttpContext();
        inboxContext.Items["CurrentUser"] = ada;
        await InboxEndpoints.GetInbox(dbContext, inboxContext, cancellationToken);

        var inbox = await dbContext
            .Projects.Include(p => p.Columns)
            .FirstAsync(p => p.IsInbox && p.CreatedById == ada.Id, cancellationToken);

        dbContext.ProjectTasks.Add(
            new ProjectTask
            {
                Name = "Buy milk",
                Description = "",
                Score = 1000,
                Priority = ProjectTaskPriority.LOW,
                RelatedProjectId = inbox.Id,
                RelatedColumnId = inbox.Columns.OrderBy(c => c.Score).First().Id,
            }
        );

        await dbContext.SaveChangesAsync(cancellationToken);

        return $"""
            Seeded “{ProjectName}” (project {project.Id}) with 6 tasks, a checklist, a recurring
            task, a comment thread with a mention, and one Inbox capture.

            Sign in as any of:
              {Ada.Email}
              {Grace.Email}
              {Linus.Email}
            Password: {Password}
            """;
    }

    private static ProjectTask Task(
        ProjectColumn column,
        string name,
        DateTimeOffset? dueDate,
        ProjectTaskPriority priority,
        params User[] assignees
    ) =>
        new()
        {
            Name = name,
            Description = "",
            Score = 1000,
            Priority = priority,
            DueDate = dueDate,
            RelatedColumnId = column.Id,
            RelatedProjectId = column.ProjectId,
            Assignees = [.. assignees],
        };

    /// <summary>
    /// Finds a fixture account or creates it, confirmed and ready to log in.
    /// <para>
    /// Identity is the email, which is what makes the whole seeder idempotent: a second run
    /// finds the same three people rather than minting three more.
    /// </para>
    /// </summary>
    private static async Task<User> EnsureUserAsync(
        ApplicationDbContext dbContext,
        Person person,
        CancellationToken cancellationToken
    )
    {
        var existing = await dbContext.Users.FirstOrDefaultAsync(
            u => u.Email == person.Email,
            cancellationToken
        );

        if (existing is not null)
            return existing;

        var user = new User
        {
            Name = person.Name,
            Email = person.Email,
            Password = "placeholder",
            // Confirmed, because the "EmailConfirmed" policy gates every route under /_app and
            // an unconfirmed fixture account cannot load a single page.
            EmailConfirmed = true,
        };

        user.Password = new PasswordHasher<User>().HashPassword(user, Password);

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        return user;
    }
}
