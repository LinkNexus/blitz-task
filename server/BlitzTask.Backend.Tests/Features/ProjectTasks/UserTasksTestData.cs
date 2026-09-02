using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Infrastructure.Data;

namespace BlitzTask.Backend.Tests.Features.ProjectTasks;

/// <summary>
/// Seeding shared by the two halves of GET /api/tasks — the projection and the handler that
/// filters it. Every project gets a "Todo" and a "Done" column so a test always has both an
/// incomplete and a completed position to place a task in.
/// </summary>
internal static class UserTasksTestData
{
    internal static async Task<(
        Project Project,
        ProjectColumn Todo,
        ProjectColumn Done
    )> SeedProjectAsync(
        ApplicationDbContext dbContext,
        string name,
        int ownerId,
        params (int UserId, ProjectRole Role)[] others
    )
    {
        var todo = new ProjectColumn { Name = "Todo", Color = "#FF0000", Score = 0 };
        var done = new ProjectColumn { Name = "Done", Color = "#00FF00", Score = 1000 };

        var project = new Project
        {
            Name = name,
            Description = $"{name} description",
            CreatedById = ownerId,
            Columns = [todo, done],
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
        return (project, todo, done);
    }

    internal static async Task<ProjectTask> SeedTaskAsync(
        ApplicationDbContext dbContext,
        Project project,
        ProjectColumn column,
        string name,
        DateTimeOffset? dueDate = null,
        ProjectTaskPriority priority = ProjectTaskPriority.MEDIUM,
        params User[] assignees
    )
    {
        var task = new ProjectTask
        {
            Name = name,
            Description = "",
            Score = 1000,
            Priority = priority,
            DueDate = dueDate,
            Tags = ["alpha"],
            RelatedColumnId = column.Id,
            RelatedProjectId = project.Id,
            Assignees = [.. assignees],
        };
        dbContext.ProjectTasks.Add(task);
        await dbContext.SaveChangesAsync();
        return task;
    }
}
