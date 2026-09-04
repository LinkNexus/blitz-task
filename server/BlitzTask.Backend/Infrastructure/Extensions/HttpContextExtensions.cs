using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;

namespace BlitzTask.Backend.Infrastructure.Extensions
{
    public static class HttpContextExtensions
    {
        public static User GetUser(this HttpContext context) =>
            GetItem<User>(context, "CurrentUser");

        public static ProjectParticipant GetProjectParticipant(this HttpContext context) =>
            GetItem<ProjectParticipant>(context, "ProjectParticipant");

        /// <summary>
        /// An absolute URL back into the SPA, for a path such as
        /// <c>"/confirm-email?token=…"</c>. Emails are the only place the server has to name
        /// its own address, and it has no configured base URL to name it from, so the scheme
        /// and host come off the incoming request — which is correct behind the reverse proxy
        /// only because <c>UseForwardedHeaders</c> rewrites them first. See
        /// <see cref="ForwardedHeadersSetup"/>.
        /// </summary>
        public static string BuildAppUrl(this HttpContext context, string path) =>
            $"{context.Request.Scheme}://{context.Request.Host}{path}";

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
