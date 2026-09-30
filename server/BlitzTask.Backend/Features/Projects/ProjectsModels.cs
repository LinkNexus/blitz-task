using System.Text.Json.Serialization;
using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectMembers;
using BlitzTask.Backend.Features.ProjectSections;
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

        /// <summary>
        /// Join the discussion on a task. Separate from <see cref="ManageTasks"/> even though
        /// the same roles hold both today: saying something about the work and changing the work
        /// are different acts, and folding them together would mean any future change to who may
        /// edit a task silently changed who may speak.
        /// <para>
        /// Not held by a Viewer, which is the one judgement here worth recording. A Viewer may
        /// set themselves a reminder (L25.5) because that is private; a comment is visible to
        /// everyone, and there is no "commenter" tier between the two — so granting it would
        /// make the read-only role not read-only. Someone who should be in the conversation is a
        /// Contributor, and moving this one line is all it would take to decide otherwise.
        /// </para>
        /// </summary>
        Comment,
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
                    ProjectPermission.Comment,
                ],
                [ProjectRole.Collaborator] =
                [
                    ProjectPermission.EditProject,
                    ProjectPermission.ManageParticipants,
                    ProjectPermission.ManageColumns,
                    ProjectPermission.ManageTasks,
                    ProjectPermission.Comment,
                ],
                [ProjectRole.Contributor] =
                [
                    ProjectPermission.ManageTasks,
                    ProjectPermission.Comment,
                ],
                [ProjectRole.Viewer] = [],
            };

        public static bool HasPermission(this ProjectRole role, ProjectPermission permission) =>
            _permissions.TryGetValue(role, out var perms) && perms.Contains(permission);

        public static List<ProjectPermission> GetPermissions(this ProjectRole role) =>
            _permissions.TryGetValue(role, out var perms) ? [.. perms] : [];
    }

    /// <summary>
    /// A project's accent: the colour that tells it apart from its siblings in the sidebar and
    /// names it at the top of its own board.
    /// <para>
    /// A <b>named</b> accent rather than the free hex that <c>ProjectColumn.Color</c> and
    /// <c>ProjectSection.Color</c> carry, and the difference is the whole design. Those two are
    /// only ever painted as a 2px rule or a 10px dot, where no contrast requirement applies. An
    /// accent has to survive being read — it tints a project's name and its initials — and a
    /// colour picked off a wheel cannot promise that: <c>#ffff00</c> is invisible on a white card
    /// and <c>#000080</c> on a dark one, and the user who picked it is given no hint either way.
    /// A name resolves instead to a pair of values in <c>index.css</c>, one per mode, whose
    /// contrast is asserted by <c>accent-contrast.test.ts</c> — so an accent is dark-mode-correct
    /// by the same mechanism as every other colour in the app, and a future theme change moves
    /// accents along with it. Storing a hex would have put a fourth copy of colour knowledge
    /// outside the token layer.
    /// </para>
    /// <para>
    /// The set spans the wheel rather than avoiding the hues that already mean something
    /// (red is destructive, amber is warning, green is success). That is safe only because of
    /// where an accent is allowed to appear: project-identity chrome, never a task. A red project
    /// dot beside a project name is an identity; a red pill on a card is a priority. Put an accent
    /// on a task and this stops being true.
    /// </para>
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter<ProjectAccent>))]
    public enum ProjectAccent
    {
        /// <summary>
        /// No accent — the project renders in the neutral chrome. The default, which is what
        /// every project predating this field has, so the migration needed no backfill.
        /// </summary>
        None,
        Red,
        Orange,
        Amber,
        Green,
        Teal,
        Blue,
        Violet,
        Pink,
    }

    public class Project : IAuditable, ISoftDeletable
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public string Description { get; set; } = string.Empty;
        public DateTimeOffset? StartDate { get; set; }
        public DateTimeOffset? DueDate { get; set; }
        public Guid? ImageId { get; set; }
        public List<string> Tags { get; set; } = [];

        /// <summary>See <see cref="ProjectAccent"/>. Defaults to <c>None</c>.</summary>
        public ProjectAccent Accent { get; set; }

        public DateTime UpdatedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        public int CreatedById { get; set; }

        /// <summary>
        /// The owner's Inbox: one hidden project per user, holding work captured before it has
        /// been decided where it belongs.
        /// <para>
        /// A real project rather than a nullable <c>RelatedProjectId</c> on the task, because
        /// every query, the board, the score ordering, the reminders and the whole RBAC layer
        /// already assume a task has a project and a column — a nullable owner would have made
        /// each of those a special case. What this flag buys is only the handful of places where
        /// the Inbox must *not* behave like a project: it is hidden from the project list, it
        /// cannot be deleted, and it takes no members.
        /// </para>
        /// </summary>
        public bool IsInbox { get; set; }

        public ICollection<ProjectParticipant> Participants { get; set; } = [];
        public User CreatedBy { get; set; } = null!;
        public Attachment? Image { get; set; }
        public ICollection<ProjectInvitation> Invitations { get; set; } = [];
        public ICollection<ProjectColumn> Columns { get; set; } = [];
        public ICollection<ProjectSection> Sections { get; set; } = [];
        public ICollection<ProjectTask> Tasks { get; set; } = [];

        /// <summary>
        /// Files that belong to the project rather than to any one task — a spec, a schema, a
        /// design — which a task then <i>references</i>.
        /// <para>
        /// This is the collection that makes an <see cref="Attachment"/> a shared thing, and
        /// everything awkward about L40.7 follows from it: every existing delete path was written
        /// when a file had exactly one owner, so it deletes the blob. See
        /// <c>AttachmentOrphanSweepJob</c> for where that decision now lives instead.
        /// </para>
        /// </summary>
        public ICollection<Attachment> Attachments { get; set; } = [];
    }

    /// <summary>The join behind <see cref="Project.Attachments"/>.</summary>
    public class ProjectAttachment
    {
        public int ProjectId { get; set; }
        public Guid AttachmentId { get; set; }
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
        public ProjectAccent Accent { get; init; }
        public IFormFile? Image { get; init; }

        public const int MaxImageSizeInBytes = 400 * 1024;
    }

    /// <summary>
    /// A pending invitation, as much of one as a project member has any business seeing.
    /// <para>
    /// A projection rather than the <c>ProjectInvitation</c> entity, which is what
    /// <see cref="ProjectDetails"/> used to carry. Two things came with that entity and neither
    /// should have: its <c>Token</c> — a live credential admitting whoever holds it to the
    /// project, shipped to every member on every board load — and its <c>Project</c> navigation,
    /// which dragged the whole entity graph into the generated OpenAPI schema. The second is how
    /// this was found: adding <c>Project.Sections</c> (L40.5) closed a cycle through that
    /// navigation and the document generator hit its 64-level depth limit, failing the build.
    /// </para>
    /// </summary>
    public record ProjectInvitationInfo(
        int Id,
        string GuestEmail,
        ProjectRole Role,
        DateTime CreatedAt
    );

    public record ProjectParticipantInfo(
        int Id,
        int UserId,
        string Name,
        ProjectRole Role,
        DateTime JoinedAt
    );

    /// <summary>
    /// Just enough of the Inbox to capture into it and to read its tasks back through
    /// <c>GET /api/tasks?projectId=</c>. Not <see cref="ProjectDetails"/>: that would carry the
    /// tasks a second time, in the shape the board wants rather than the shape the Inbox list
    /// renders, and the two copies would drift apart in the cache.
    /// </summary>
    public record InboxSummary(int ProjectId, int CaptureColumnId);

    /// <summary>
    /// A list row. Deliberately narrower than <see cref="ProjectDetails"/>, which carries every
    /// column, task, participant and invitation — fine for one project, far too much for a list.
    /// </summary>
    public record ProjectSummary(
        int Id,
        string Name,
        string Description,
        DateTimeOffset? StartDate,
        DateTimeOffset? DueDate,
        List<string> Tags,
        Guid? ImageId,
        ProjectAccent Accent,
        ProjectRole Role,
        int ParticipantsCount,
        int TasksCount,
        DateTime CreatedAt,
        DateTime UpdatedAt
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
        List<ProjectInvitationInfo> Invitations,
        List<ProjectColumnDetails> Columns,
        List<ProjectSections.ProjectSectionDetails> Sections,
        ProjectAccent Accent
    )
    {
        public List<ProjectPermission> UserPermissions { get; init; } = [];
    }
}
