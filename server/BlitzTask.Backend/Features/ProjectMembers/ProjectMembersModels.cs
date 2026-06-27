using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.ProjectMembers
{
    public class ProjectInvitation : ICreateable
    {
        public int Id { get; set; }
        public required string GuestEmail { get; set; }
        public required ProjectRole Role { get; set; }
        public required int ProjectId { get; set; }
        public DateTime CreatedAt { get; set; }
        public Guid Token { get; set; } = Guid.NewGuid();

        public Project Project { get; set; } = null!;

        public static TimeSpan ExpirationTime => TimeSpan.FromDays(7);
    }

    public record AddParticipantRequest(string Email, ProjectRole Role);

    public record UpdateParticipantRoleRequest(ProjectRole Role);

    public class ProjectInvitationModel
    {
        public required string InviterName { get; set; }
        public required string ProjectName { get; set; }
        public required string Role { get; set; }
        public required string InvitationLink { get; set; }
    }

    public record ProjectInvitationDetails(
        int Id,
        string GuestEmail,
        ProjectRole Role,
        int ProjectId,
        string ProjectName,
        Guid Token,
        DateTime CreatedAt
    );
}
