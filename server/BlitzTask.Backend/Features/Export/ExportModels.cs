using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Projects;

namespace BlitzTask.Backend.Features.Export
{
    /// <summary>
    /// What an export is allowed to say. A separate shape from <see cref="ProjectDetails"/>, and
    /// deliberately so on two counts.
    /// <para>
    /// <b>It must not carry secrets.</b> <c>ProjectDetails.Invitations</c> holds the
    /// <c>ProjectInvitation</c> entity, <c>Token</c> and all — a live credential that admits
    /// whoever has it to the project. That is defensible in a response to a member; it is not
    /// defensible in a file someone downloads, drops in a backup folder and forwards. Pending
    /// invitations are simply absent here.
    /// </para>
    /// <para>
    /// <b>It must mean something elsewhere.</b> Row ids identify nothing outside the instance
    /// that produced them, so people are named by <i>email</i> and structure by name. An importer
    /// — this entry's other half — can resolve those against whatever accounts exist on the far
    /// side; it could do nothing at all with <c>userId: 7</c>. For the same reason
    /// <c>UserPermissions</c>, which describes the caller rather than the data, is not here.
    /// </para>
    /// </summary>
    /// <param name="FormatVersion">
    /// Bumped when the shape below changes incompatibly. Cheap now, and the only thing that lets
    /// an importer refuse a file it cannot read rather than half-apply it.
    /// </param>
    public record ExportEnvelope(
        int FormatVersion,
        DateTime ExportedAt,
        string ExportedBy,
        List<ProjectExport> Projects
    )
    {
        public const int CurrentVersion = 1;
    }

    /// <param name="IsInbox">
    /// The Inbox is a real project carrying real captures, so it belongs in a backup — but it is
    /// not one the owner ever named or navigated to, and an importer that recreated it as an
    /// ordinary project would leave them with a stray board called "Inbox".
    /// </param>
    public record ProjectExport(
        string Name,
        string Description,
        DateTimeOffset? StartDate,
        DateTimeOffset? DueDate,
        List<string> Tags,
        bool IsInbox,
        DateTime CreatedAt,
        List<ProjectMemberExport> Members,
        List<ColumnExport> Columns
    );

    public record ProjectMemberExport(
        string Name,
        string Email,
        ProjectRole Role,
        DateTime JoinedAt
    );

    public record ColumnExport(string Name, string Color, float Score, List<TaskExport> Tasks);

    /// <param name="Attachments">
    /// File names only. The bytes live on disk under <c>Uploads/</c> and are backed up at the
    /// file level (L23) — putting them in here would turn a text export into a multi-megabyte
    /// archive, and a JSON one into base64. Listing them at least tells a reader what a task is
    /// missing.
    /// </param>
    public record TaskExport(
        string Name,
        string Description,
        ProjectTaskPriority Priority,
        float Score,
        List<string> Tags,
        DateTimeOffset? StartDate,
        DateTimeOffset? DueDate,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        List<string> Assignees,
        List<ChecklistItemExport> Checklist,
        List<CommentExport> Comments,
        List<string> Attachments,
        RecurrenceExport? Recurrence
    );

    public record ChecklistItemExport(string Text, bool IsDone, int Position);

    public record CommentExport(string Author, string Body, DateTime CreatedAt);

    public record RecurrenceExport(RecurrenceFrequency Frequency, int Interval, List<int> Weekdays);
}
