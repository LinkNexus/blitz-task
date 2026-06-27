using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.ProjectColumns
{
    public class ProjectColumn : IAuditable
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public required float Score { get; set; }
        public int ProjectId { get; set; }

        public DateTime UpdatedAt { get; set; }
        public DateTime CreatedAt { get; set; }

        public Project Project { get; set; } = null!;
        public ICollection<ProjectTask> Tasks { get; set; } = [];
    }

    public record CreateProjectColumnRequest(string Name, float Score);
}
