using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.Projects
{
    public enum ProjectRole
    {
        Owner,
        Admin,
        Contributor,
        Viewer,
    }

    public class Project : IAuditable
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public string Description { get; set; } = string.Empty;
        public DateTimeOffset? StartDate { get; set; }
        public DateTimeOffset? DueDate { get; set; }
        public Guid? ImageId { get; set; }
        public List<string> Tags { get; set; } = [];
        public DateTime UpdatedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public int CreatedById { get; set; }

        public ICollection<ProjectParticipant> Participants { get; set; } = [];
        public User CreatedBy { get; set; } = null!;
        public Attachment? Image { get; set; }
    }

    public class ProjectParticipant : ICreateable
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public int UserId { get; set; }
        public ProjectRole Role { get; set; }
        public DateTime CreatedAt { get; set; }

        public User User { get; set; } = null!;
        public Project Project { get; set; } = null!;
    }

    public record CreateProjectRequest(
        string Name,
        string Description,
        IFormFile? Image,
        List<string>? Tags,
        DateTimeOffset? StartDate = null,
        DateTimeOffset? DueDate = null
    );

    public record ProjectParticipantInfo(
        int UserId,
        string Name,
        ProjectRole Role,
        DateTime JoinedAt
    );

    public record ProjectDetails(
        int Id,
        string Name,
        string Description,
        DateTimeOffset? StartDate,
        DateTimeOffset? DueDate,
        List<string> Tags,
        int CreatedBy,
        List<ProjectParticipantInfo> Participants,
        Guid? ImageId
    );
}
