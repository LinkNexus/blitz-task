using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.Attachments
{
    public class Attachment : IAuditable
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public required string StoredFilename { get; set; }

        public required string OriginalFilename { get; set; }

        public required string Extension { get; set; }

        public required string ContentType { get; set; }

        public long SizeInBytes { get; set; }

        public required string StorageDirectory { get; set; }

        public int UploadedByUserId { get; set; }

        public string GetFullPath(string baseDirectory)
        {
            return Path.Combine(baseDirectory, StorageDirectory, $"{StoredFilename}{Extension}");
        }

        public DateTime UpdatedAt { get; set; }
        public DateTime CreatedAt { get; set; }

        public User? UploadedBy { get; set; }
    }

    /// <summary>
    /// A file the project holds, and how many of its tasks point at it.
    /// <para>
    /// Separate from <see cref="AttachmentMetadata"/> because of that last field: a task's
    /// attachment has no reference count to report — it is the thing doing the referencing.
    /// </para>
    /// </summary>
    public record ProjectAttachmentDetails(
        Guid Id,
        string OriginalFileName,
        string ContentType,
        long SizeInBytes,
        DateTime UploadedAt,
        int ReferencedByTaskCount
    );

    public record AttachmentMetadata(
        Guid Id,
        string OriginalFileName,
        string ContentType,
        long SizeInBytes,
        DateTime UploadedAt
    );
}
