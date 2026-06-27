namespace BlitzTask.Backend.Features.ProjectTasks
{
    public static class ProjectTasksModelsExtensions
    {
        public static ProjectTaskDetails ToProjectTasksDetails(this ProjectTask task)
        {
            return new ProjectTaskDetails(
                task.Id,
                task.Name,
                task.Description,
                task.Priority,
                task.Score,
                task.Tags,
                task.StartDate,
                task.DueDate,
                task.CreatedAt,
                task.UpdatedAt,
                [.. task.Assignees.Select(a => a.Id)],
                [.. task.Attachments.Select(a => a.Id)]
            );
        }
    }
}
