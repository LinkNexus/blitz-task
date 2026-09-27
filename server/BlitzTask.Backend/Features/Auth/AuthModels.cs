using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.Auth
{
    public enum UserTokenType
    {
        EmailConfirmation,
        PasswordReset,
        SecurityStamp,

        /// <summary>
        /// The secret in a calendar subscription URL. Unlike the three above it is a
        /// <b>long-lived, non-expiring</b> credential the user hands to a third party (Google,
        /// Apple, whoever polls the feed), so it is revoked by deleting it rather than by
        /// waiting, and there is at most one per person — rotating it is what breaks every
        /// existing subscription at once, which is the point.
        /// </summary>
        CalendarFeed,
    }

    public class UserToken
    {
        public int Id { get; set; }
        public required string Value { get; set; }
        public int UserId { get; set; }
        public required UserTokenType Type { get; set; }
        public DateTime? ExpiresAt { get; set; }

        public User User { get; set; } = null!;
    }

    public class User : IAuditable
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public required string Email { get; set; }
        public string Password { get; set; }
        public bool EmailConfirmed { get; set; } = false;

        public DateTime UpdatedAt { get; set; }
        public DateTime CreatedAt { get; set; }

        public ICollection<UserToken> Tokens { get; set; } = [];
        public List<ProjectParticipant> ProjectParticipations { get; set; } = [];
    }

    public record LoginRequest(string Email, string Password, bool RememberMe);

    public record CurrentUser(
        int Id,
        string Name,
        string Email,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        bool EmailConfirmed
    );

    public record CreateUserRequest(
        string Name,
        string Email,
        string Password,
        string ConfirmPassword
    );

    public record ConfirmEmailRequest(int UserId, string Token);

    public record RequestPasswordResetRequest(string Email);

    public record ResetPasswordRequest(
        int UserId,
        string Token,
        string Password,
        string ConfirmPassword
    );

    public class ConfirmEmailModel
    {
        public required string UserName { get; set; }
        public required string ConfirmationLink { get; set; }
    }

    public class PasswordResetModel
    {
        public required string UserName { get; set; }
        public required string ResetLink { get; set; }
    }
}
