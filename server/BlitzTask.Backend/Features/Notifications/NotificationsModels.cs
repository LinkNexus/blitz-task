using System.Text.Json.Serialization;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.Notifications
{
    [JsonConverter(typeof(JsonStringEnumConverter<NotificationKind>))]
    public enum NotificationKind
    {
        /// <summary>Someone put a task on you.</summary>
        TASK_ASSIGNED,

        /// <summary>Someone said something on a task you are part of.</summary>
        TASK_COMMENTED,
    }

    /// <summary>
    /// Something that happened <b>to you</b>.
    /// <para>
    /// Deliberately its own table rather than a view over L31's <see cref="Activity.ActivityEvent"/>,
    /// and the reason is a shape mismatch rather than a performance one: an activity entry is
    /// about a <i>project</i> and a notification is about a <i>person</i>. One act produces one
    /// activity row and <b>N</b> notification rows — one per person who should hear about it,
    /// often zero. Deriving that would mean re-deciding who cares on every single read, against
    /// a feed that is mostly other people's business.
    /// </para>
    /// <para>
    /// Labels are denormalised for the same reason they are on an activity entry: a notification
    /// outlives the task it points at, and one that has to resolve a name at read time stops
    /// being readable the moment the thing is deleted.
    /// </para>
    /// </summary>
    public class Notification : ICreateable
    {
        public int Id { get; set; }

        /// <summary>Who is being told. The only thing that makes this row theirs.</summary>
        public int UserId { get; set; }

        public NotificationKind Kind { get; set; }

        public int ActorId { get; set; }
        public required string ActorName { get; set; }

        public int ProjectId { get; set; }

        /// <summary>
        /// Null once the task is purged. The row stays — "you were assigned something that has
        /// since been deleted" is still a true thing to have been told.
        /// </summary>
        public int? TaskId { get; set; }
        public string? TaskName { get; set; }

        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// When it was read, or null. A nullable timestamp rather than a bool because "read" is
        /// an event with a time, and the cheap version throws that away for nothing.
        /// </summary>
        public DateTime? ReadAt { get; set; }

        public User User { get; set; } = null!;
        public User Actor { get; set; } = null!;
        public Project Project { get; set; } = null!;
        public ProjectTask? Task { get; set; }
    }

    public record NotificationDetails(
        int Id,
        NotificationKind Kind,
        int ActorId,
        string ActorName,
        int ProjectId,
        int? TaskId,
        string? TaskName,
        DateTime CreatedAt,
        bool IsRead
    );

    /// <summary>
    /// The bell needs two things at once — how many are unread, and the most recent few — and a
    /// count that disagreed with the list it sits above would be worse than either alone. One
    /// response, one moment in time.
    /// </summary>
    public record NotificationsResponse(int UnreadCount, List<NotificationDetails> Items);

    public static class NotificationFeed
    {
        public const int MaxPageSize = 50;
        public const int DefaultPageSize = 20;
    }
}
