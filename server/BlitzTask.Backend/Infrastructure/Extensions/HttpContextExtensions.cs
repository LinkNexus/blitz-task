using BlitzTask.Backend.Features.Auth;

namespace BlitzTask.Backend.Infrastructure.Extensions
{
    public static class HttpContextExtensions
    {
        public static User GetUser(this HttpContext context) =>
            GetItem<User>(context, "CurrentUser");

        public static T GetItem<T>(this HttpContext context, string key)
        {
            if (context.Items.TryGetValue(key, out var item) && item is T tItem)
            {
                return tItem;
            }

            throw new InvalidOperationException($"{key} not found in HttpContext.");
        }
    }
}
