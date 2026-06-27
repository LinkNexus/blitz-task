using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BlitzTask.Backend.Features.Attachments
{
    public sealed class FileUploadSettings
    {
        public const string SectionName = "FileUpload";

        [Required(ErrorMessage = "UploadDirectory must be configured")]
        public required string UploadDirectory { get; init; }

        public required long MaxFileSizeInBytes { get; init; }

        public required Dictionary<string, string[]> AllowedFileTypes { get; init; }

        public required string[] AllowedDirectories { get; init; }

        public IEnumerable<string> ValidImageContentTypes
        {
            get =>
                AllowedFileTypes
                    .Where(kvp => kvp.Key.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                    .Select(kvp => kvp.Key);
        }
    }

    public record FileUploadResult(bool Success, string? ErrorMessage, Attachment? Attachment);

    public record FileDownloadResult(Stream FileStream, string FileName, string ContentType);

    public interface IFileService
    {
        Task<FileUploadResult> UploadFileAsync(
            IFormFile file,
            string directory,
            int uploadedById,
            long? maxFileSizeBytes = null,
            CancellationToken cancellationToken = default
        );

        Task<FileDownloadResult?> GetFileAsync(
            Guid fileId,
            CancellationToken cancellationToken = default
        );

        Task<bool> DeleteFileAsync(Guid fileId, CancellationToken cancellationToken = default);
    }

    public class LocalFileService : IFileService
    {
        private readonly string _baseUploadDirectory;
        private readonly ApplicationDbContext _dbContext;
        private readonly ILogger<LocalFileService> _logger;
        private readonly IOptions<FileUploadSettings> _settings;

        public LocalFileService(
            ApplicationDbContext dbContext,
            ILogger<LocalFileService> logger,
            IOptions<FileUploadSettings> settings
        )
        {
            _dbContext = dbContext;
            _logger = logger;
            _settings = settings;
            _baseUploadDirectory = settings.Value.UploadDirectory;

            Directory.CreateDirectory(_baseUploadDirectory);

            foreach (var dir in _settings.Value.AllowedDirectories)
            {
                Directory.CreateDirectory(Path.Combine(_baseUploadDirectory, dir));
            }

            _logger.LogInformation(
                "FileService initialized with base directory: {BaseDirectory}",
                _baseUploadDirectory
            );
        }

        public async Task<FileUploadResult> UploadFileAsync(
            IFormFile file,
            string directory,
            int uploadedByUserId,
            long? maxFileSizeBytes = null,
            CancellationToken cancellationToken = default
        )
        {
            try
            {
                if (!ValidateDirectory(directory))
                {
                    _logger.LogWarning(
                        "Invalid directory requested: {Directory} by user {UserId}",
                        directory,
                        uploadedByUserId
                    );
                    return new FileUploadResult(false, "Invalid directory specified", null);
                }

                if (file == null || file.Length == 0)
                {
                    return new FileUploadResult(false, "No file provided", null);
                }

                long realMaxSizeBytes = maxFileSizeBytes is not null
                    ? Math.Min(maxFileSizeBytes.Value, _settings.Value.MaxFileSizeInBytes)
                    : _settings.Value.MaxFileSizeInBytes;

                if (file.Length > realMaxSizeBytes)
                {
                    _logger.LogWarning(
                        "File size {Size} exceeds limit {MaxSize} for user {UserId}",
                        file.Length,
                        realMaxSizeBytes,
                        uploadedByUserId
                    );
                    return new FileUploadResult(
                        false,
                        $"File size exceeds maximum allowed size of {realMaxSizeBytes / 1024 / 1024} MB",
                        null
                    );
                }

                var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
                var contentType = file.ContentType.ToLowerInvariant();

                if (!ValidateFileType(contentType, extension))
                {
                    _logger.LogWarning(
                        "Invalid file type: {ContentType} / {Extension} for user {UserId}",
                        contentType,
                        extension,
                        uploadedByUserId
                    );
                    return new FileUploadResult(
                        false,
                        $"File type not allowed. Allowed types: images, PDFs, and common office documents",
                        null
                    );
                }

                var storedFileName = GenerateSecureFileName();
                var sanitizedOriginalFileName = SanitizeFileName(
                    Path.GetFileNameWithoutExtension(file.FileName)
                );

                // Build safe file path
                var targetDirectory = Path.Combine(_baseUploadDirectory, directory);
                var filePath = Path.Combine(targetDirectory, $"{storedFileName}{extension}");

                // Double-check that the final path is within allowed directory (defense in depth)
                var fullTargetPath = Path.GetFullPath(filePath);
                var fullBasePath = Path.GetFullPath(_baseUploadDirectory);

                if (!fullTargetPath.StartsWith(fullBasePath, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogError(
                        "Path traversal attempt detected! Target: {Target}, Base: {Base}",
                        fullTargetPath,
                        fullBasePath
                    );
                    return new FileUploadResult(false, "Security violation detected", null);
                }

                // Create file entity
                var fileEntity = new Attachment
                {
                    StoredFilename = storedFileName,
                    OriginalFilename = $"{sanitizedOriginalFileName}{extension}",
                    Extension = extension,
                    ContentType = contentType,
                    SizeInBytes = file.Length,
                    StorageDirectory = directory,
                    UploadedByUserId = uploadedByUserId,
                };

                await using (
                    var stream = new FileStream(
                        filePath,
                        FileMode.Create,
                        FileAccess.Write,
                        FileShare.None,
                        bufferSize: 4096,
                        useAsync: true
                    )
                )
                {
                    await file.CopyToAsync(stream, cancellationToken);
                }

                _dbContext.Attachments.Add(fileEntity);
                await _dbContext.SaveChangesAsync(cancellationToken);

                _logger.LogInformation(
                    "File uploaded successfully. ID: {FileId}, Original: {OriginalName}, Size: {Size} bytes, User: {UserId}",
                    fileEntity.Id,
                    fileEntity.OriginalFilename,
                    fileEntity.SizeInBytes,
                    uploadedByUserId
                );

                return new FileUploadResult(true, null, fileEntity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading file for user {UserId}", uploadedByUserId);
                return new FileUploadResult(
                    false,
                    "An error occurred while uploading the file",
                    null
                );
            }
        }

        public async Task<FileDownloadResult?> GetFileAsync(
            Guid fileId,
            CancellationToken cancellationToken = default
        )
        {
            try
            {
                var fileEntity = await _dbContext
                    .Attachments.AsNoTracking()
                    .FirstOrDefaultAsync(f => f.Id == fileId, cancellationToken);

                if (fileEntity == null)
                {
                    _logger.LogWarning("File not found: {FileId}", fileId);
                    return null;
                }

                var filePath = fileEntity.GetFullPath(_baseUploadDirectory);

                if (!File.Exists(filePath))
                {
                    _logger.LogError(
                        "File metadata exists but file not found on disk: {FilePath}",
                        filePath
                    );
                    return null;
                }

                var fileStream = new FileStream(
                    filePath,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.Read,
                    bufferSize: 4096,
                    useAsync: true
                );

                _logger.LogInformation("File retrieved: {FileId}", fileId);

                return new FileDownloadResult(
                    fileStream,
                    fileEntity.OriginalFilename,
                    fileEntity.ContentType
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving file {FileId}", fileId);
                return null;
            }
        }

        public async Task<bool> DeleteFileAsync(
            Guid fileId,
            CancellationToken cancellationToken = default
        )
        {
            try
            {
                var fileEntity = await _dbContext.Attachments.FirstOrDefaultAsync(
                    f => f.Id == fileId,
                    cancellationToken
                );

                if (fileEntity == null)
                {
                    _logger.LogWarning("Attempted to delete non-existent file: {FileId}", fileId);
                    return false;
                }

                var filePath = fileEntity.GetFullPath(_baseUploadDirectory);
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                }

                _dbContext.Attachments.Remove(fileEntity);
                await _dbContext.SaveChangesAsync(cancellationToken);

                _logger.LogInformation("File deleted: {FileId}", fileId);

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting file {FileId}", fileId);
                return false;
            }
        }

        private bool ValidateDirectory(string directory)
        {
            return !(
                !_settings.Value.AllowedDirectories.Contains(directory)
                || directory.Contains("..")
                || directory.Contains('/')
                || directory.Contains('\\')
                || Path.IsPathRooted(directory)
            );
        }

        private bool ValidateFileType(string contentType, string extension)
        {
            if (
                !_settings.Value.AllowedFileTypes.TryGetValue(
                    contentType,
                    out var allowedExtensions
                )
            )
            {
                return false;
            }

            return allowedExtensions.Contains(extension);
        }

        private static string GenerateSecureFileName()
        {
            var bytes = RandomNumberGenerator.GetBytes(32);
            return Convert.ToBase64String(bytes).Replace("+", "").Replace("/", "").Replace("=", "")[
                ..32
            ];
        }

        private static string SanitizeFileName(string fileName)
        {
            var invalidChars = Path.GetInvalidFileNameChars();
            var sanitized = string.Join(
                "_",
                fileName.Split(invalidChars, StringSplitOptions.RemoveEmptyEntries)
            );

            if (sanitized.Length > 100)
            {
                sanitized = sanitized[..100];
            }

            return sanitized;
        }
    }
}
