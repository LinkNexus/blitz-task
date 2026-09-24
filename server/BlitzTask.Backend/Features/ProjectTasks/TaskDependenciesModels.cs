namespace BlitzTask.Backend.Features.ProjectTasks
{
    /// <summary>
    /// "This task is blocked by that one" (L40.6). One edge of a directed graph:
    /// <see cref="DependentTaskId"/> cannot sensibly be finished until
    /// <see cref="DependsOnTaskId"/> is.
    /// <para>
    /// <b>Same project only.</b> A cross-project edge would leak a task's title across the one
    /// RBAC boundary this app has — every membership filter is
    /// <c>Participants.Any(...)</c> against a task's single project, so a blocker from elsewhere
    /// would be rendered to someone who cannot open it. Allowing that later means teaching the
    /// read path to project only what the viewer may see, which is a different and larger job.
    /// </para>
    /// <para>
    /// <b>Advisory, not enforced.</b> Nothing here stops a blocked task being completed. In a
    /// personal tool there is always a legitimate override, and a hard block turns a guardrail
    /// into an obstacle — so the server stores the edges and the client says something when they
    /// are unsatisfied.
    /// </para>
    /// </summary>
    public class ProjectTaskDependency
    {
        public int DependentTaskId { get; set; }
        public int DependsOnTaskId { get; set; }

        public ProjectTask DependentTask { get; set; } = null!;
        public ProjectTask DependsOnTask { get; set; } = null!;
    }

    public record AddTaskDependencyRequest(int DependsOnTaskId);

    /// <param name="ColumnId">
    /// The column rather than a computed "is it done": completion is a <i>position</i> in this
    /// app, and the client already holds the columns to judge it by. Deciding here would put a
    /// second copy of that rule on the server, one projection away from the first.
    /// </param>
    public record TaskDependencyLink(int Id, string Name, int ColumnId);
}
