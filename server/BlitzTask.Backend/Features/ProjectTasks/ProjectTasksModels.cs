using System.Text.Json.Serialization;
using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    [JsonConverter(typeof(JsonStringEnumConverter<ProjectTaskPriority>))]
    public enum ProjectTaskPriority
    {
        LOW,
        MEDIUM,
        HIGH,
        URGENT,
    }

    public class ProjectTask : IAuditable
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public required string Description { get; set; }
        public ProjectTaskPriority Priority { get; set; }
        public required int RelatedColumnId { get; set; }
        public required int RelatedProjectId { get; set; }
        public required float Score { get; set; }
        public List<string> Tags { get; set; } = [];
        public DateTimeOffset? StartDate { get; set; }
        public DateTimeOffset? DueDate { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public ICollection<User> Assignees { get; set; } = [];
        public ProjectColumn RelatedColumn { get; set; } = null!;
        public Project RelatedProject { get; set; } = null!;
        public ICollection<Attachment> Attachments { get; set; } = [];
        public ICollection<TaskReminder> Reminders { get; set; } = [];

        public static int MaxTagsCount => 5;
        public static int MaxTagsLength => 20;
        public static int MaxAttachmentsCount => 5;
    }

    public class ProjectTaskAttachment
    {
        public int ProjectTaskId { get; set; }
        public Guid AttachmentId { get; set; }
    }

    public record CreateProjectTaskRequest
    {
        public string Name { get; set; } = null!;
        public string Description { get; set; } = null!;
        public ProjectTaskPriority Priority { get; set; }
        public List<string>? Tags { get; set; } = [];
        public DateTimeOffset? StartDate { get; set; }
        public DateTimeOffset? DueDate { get; set; }
        public List<int>? AssigneeIds { get; set; } = [];
        public List<IFormFile>? Attachments { get; set; } = [];
    }

    public record MoveProjectTaskRequest(int ColumnId, float Score);

    public record UpdateProjectTaskRequest
    {
        public string Name { get; set; } = null!;
        public string Description { get; set; } = null!;
        public ProjectTaskPriority Priority { get; set; }
        public List<string>? Tags { get; set; } = [];
        public DateTimeOffset? StartDate { get; set; }
        public DateTimeOffset? DueDate { get; set; }
        public List<int>? AssigneeIds { get; set; } = [];
        public List<IFormFile>? NewAttachments { get; set; }
        public List<Guid>? RemovedAttachmentIds { get; set; }
    }

    /// <summary>
    /// A task as seen from outside its project — the dashboard's "my tasks" list. Carries the
    /// project and column it belongs to, because a cross-project list is meaningless without
    /// them, and drops attachments and description-level detail, which a list never renders.
    /// </summary>
    /// <summary>
    /// Files a task into a project — the way out of the Inbox. <c>ColumnId</c> is optional
    /// because the caller filing a capture has no opinion about status: unset means the target
    /// project's first column.
    /// </summary>
    public record FileTaskRequest(int ProjectId, int? ColumnId);

    public record UserTaskSummary(
        int Id,
        string Name,
        string Description,
        ProjectTaskPriority Priority,
        List<string> Tags,
        DateTimeOffset? StartDate,
        DateTimeOffset? DueDate,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        List<int> AssigneeIds,
        int ProjectId,
        string ProjectName,
        int ColumnId,
        string ColumnName,
        string ColumnColor,
        bool IsCompleted,
        // So a list row knows to link an Inbox capture to /inbox rather than to a board the
        // user is not supposed to be managing.
        bool IsInbox
    );

    public record ProjectTaskDetails(
        int Id,
        string Name,
        string Description,
        ProjectTaskPriority Priority,
        float Score,
        List<string> Tags,
        DateTimeOffset? StartDate,
        DateTimeOffset? DueDate,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        List<int> AssigneeIds,
        List<AttachmentMetadata> Attachments,
        int ColumnId
    );
}
