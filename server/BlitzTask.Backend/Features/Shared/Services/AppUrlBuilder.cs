using Microsoft.Extensions.Options;

namespace BlitzTask.Backend.Features.Shared.Services
{
    public class AppSettings
    {
        public const string SectionName = "App";

        /// <summary>
        /// The public origin of this instance, e.g. <c>https://blitz.example.com</c>. Set through
        /// <c>App__BaseUrl</c>. Optional only for local development, where the request is a
        /// reliable stand-in.
        /// </summary>
        public string? BaseUrl { get; set; }
    }

    /// <summary>
    /// Builds absolute URLs back into the SPA for emails.
    /// <para>
    /// Configuration first, request second, and the order matters for two independent reasons.
    /// A <b>background job has no request at all</b> — the reminder sweep runs on a timer, so
    /// there is simply no scheme or host to read, and a relative link is what comes out if you
    /// try. And even inside a request, deriving the origin depends on the reverse proxy sending
    /// <c>X-Forwarded-Proto</c>, which is configuration this app can neither see nor test
    /// (ROADMAP L14: it did not, and links came out <c>http://</c>).
    /// </para>
    /// </summary>
    public class AppUrlBuilder(IOptions<AppSettings> settings, IHttpContextAccessor accessor)
    {
        public string Build(string path)
        {
            var origin = ResolveOrigin();
            return $"{origin}{(path.StartsWith('/') ? path : "/" + path)}";
        }

        private string ResolveOrigin()
        {
            var configured = settings.Value.BaseUrl;
            if (!string.IsNullOrWhiteSpace(configured))
                return configured.TrimEnd('/');

            var request = accessor.HttpContext?.Request;
            if (request is not null)
                return $"{request.Scheme}://{request.Host}";

            // Reached only from a background job on an instance with no App__BaseUrl. Throwing
            // beats emitting a relative href: a link that silently goes nowhere is worse than a
            // logged failure the operator can act on, and the job isolates the exception anyway.
            throw new InvalidOperationException(
                "App__BaseUrl is not configured and there is no HTTP request to fall back to. "
                    + "Set App__BaseUrl to this instance's public origin, e.g. https://blitz.example.com."
            );
        }
    }
}
