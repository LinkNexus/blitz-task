using System.Text.Json.Serialization;
using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectMembers;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.Projects
{
    [JsonConverter(typeof(JsonStringEnumConverter<ProjectRole>))]
    public enum ProjectRole
    {
        Owner,
        Collaborator,
        Contributor,
        Viewer,
    }

    [JsonConverter(typeof(JsonStringEnumConverter<ProjectPermission>))]
    public enum ProjectPermission
    {
        EditProject,
        DeleteProject,
        ManageParticipants,
        ManageCollaborators,
        PromoteToCollaborator,
        ManageColumns,
        ManageTasks,
    }

    public static class ProjectPermissions
    {
        private static readonly Dictionary<ProjectRole, HashSet<ProjectPermission>> _permissions =
            new()
            {
                [ProjectRole.Owner] =
                [
                    ProjectPermission.EditProject,
                    ProjectPermission.DeleteProject,
                    ProjectPermission.ManageParticipants,
                    ProjectPermission.ManageCollaborators,
                    ProjectPermission.PromoteToCollaborator,
                    ProjectPermission.ManageColumns,
                    ProjectPermission.ManageTasks,
                ],
                [ProjectRole.Collaborator] =
                [
                    ProjectPermission.EditProject,
                    ProjectPermission.ManageParticipants,
                    ProjectPermission.ManageColumns,
                    ProjectPermission.ManageTasks,
                ],
                [ProjectRole.Contributor] = [ProjectPermission.ManageTasks],
                [ProjectRole.Viewer] = [],
            };

        public static bool HasPermission(this ProjectRole role, ProjectPermission permission) =>
            _permissions.TryGetValue(role, out var perms) && perms.Contains(permission);

        public static List<ProjectPermission> GetPermissions(this ProjectRole role) =>
            _permissions.TryGetValue(role, out var perms) ? [.. perms] : [];
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
        public ICollection<ProjectInvitation> Invitations { get; set; } = [];
        public ICollection<ProjectColumn> Columns { get; set; } = [];
        public ICollection<ProjectTask> Tasks { get; set; } = [];
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

    public record ProjectRequest
    {
        public string Name { get; init; } = null!;
        public string Description { get; init; } = null!;
        public List<string>? Tags { get; init; }
        public DateTimeOffset? StartDate { get; init; }
        public DateTimeOffset? DueDate { get; init; }
        public IFormFile? Image { get; init; }

        public const int MaxImageSizeInBytes = 400 * 1024;
    }

    public record ProjectParticipantInfo(
        int Id,
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
        Guid? ImageId,
        List<ProjectInvitation> Invitations,
        List<ProjectColumnDetails> Columns
    )
    {
        public List<ProjectPermission> UserPermissions { get; init; } = [];
    }
}
