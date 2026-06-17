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
            return Path.Combine(baseDirectory, StorageDirectory, StoredFilename);
        }

        public DateTime UpdatedAt { get; set; }
        public DateTime CreatedAt { get; set; }

        public User? UploadedBy { get; set; }
    }

    public record AttachmentMetadata(
        Guid Id,
        string OriginalFileName,
        string ContentType,
        long SizeInBytes,
        DateTime UploadedAt
    );
}
