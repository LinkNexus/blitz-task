using BlitzTask.Backend.Features.Auth;

namespace BlitzTask.Backend.Infrastructure.Extensions
{
    public static class HttpContextExtensions
    {
        public static User GetUser(this HttpContext context)
        {
            if (context.Items.TryGetValue("CurrentUser", out var user) && user is User u)
            {
                return u;
            }

            throw new InvalidOperationException(
                "User not found in HttpContext. Is the route protected?"
            );
        }
    }
}
