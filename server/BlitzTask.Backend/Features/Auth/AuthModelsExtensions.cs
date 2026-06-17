namespace BlitzTask.Backend.Features.Auth
{
    public static class AuthModelsExtensions
    {
        public static CurrentUser ToCurrentUser(this User user)
        {
            return new CurrentUser(
                Id: user.Id,
                Email: user.Email,
                Name: user.Name,
                CreatedAt: user.CreatedAt,
                UpdatedAt: user.UpdatedAt,
                EmailConfirmed: user.EmailConfirmed
            );
        }
    }
}
