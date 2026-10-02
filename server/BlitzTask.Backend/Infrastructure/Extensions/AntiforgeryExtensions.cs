using Microsoft.AspNetCore.Antiforgery;
using System.Security.Claims;

namespace BlitzTask.Backend.Infrastructure.Extensions
{
    public static class AntiforgeryExtensions
    {
        /// <summary>
        /// The cookie the SPA reads the antiforgery request token out of, to echo back as
        /// <c>X-XSRF-TOKEN</c>. Readable by script on purpose — that is the whole mechanism — and
        /// named in one place so the three sites that write it cannot drift apart.
        /// </summary>
        public const string RequestTokenCookie = "XSRF-TOKEN";

        /// <summary>
        /// Mints a fresh antiforgery request token for whoever <see cref="HttpContext.User"/>
        /// currently is, and writes it to <see cref="RequestTokenCookie"/>.
        /// </summary>
        public static void IssueAntiforgeryCookie(this HttpContext context, IAntiforgery antiforgery)
        {
            var tokens = antiforgery.GetAndStoreTokens(context);
            context.Response.Cookies.Append(RequestTokenCookie, tokens.RequestToken!);
        }

        /// <summary>
        /// Re-issues the antiforgery cookie after the signed-in identity has changed.
        /// <para>
        /// <b>Required, not hygiene.</b> ASP.NET binds the request token to the identity's name
        /// claim, so a token minted for whoever the caller was <i>before</i> this moment — on a
        /// fresh visit, nobody — is rejected by every later form post with
        /// <i>"The provided antiforgery token was meant for a different claims-based user than the
        /// current user"</i>. The client cannot notice: `ensureCsrfToken` fetches a token only
        /// when the cookie is missing, and logging in neither clears it nor reloads the page. The
        /// symptom is that a brand-new account can read everything and save nothing, with the
        /// failure surfacing as a 400 from the endpoint rather than from the sign-in that caused
        /// it. Only the server knows the identity changed, so only the server can fix it.
        /// </para>
        /// <para>
        /// <paramref name="identity"/> has to be passed in rather than read back off the context:
        /// <c>SignInAsync</c> writes the auth cookie to the <i>response</i> and leaves
        /// <see cref="HttpContext.User"/> describing the old identity for the rest of the request,
        /// so minting a token without this would mint it for the user we just stopped being.
        /// Pass an empty identity when signing out.
        /// </para>
        /// </summary>
        public static void ReissueAntiforgeryFor(
            this HttpContext context,
            ClaimsIdentity identity,
            IAntiforgery antiforgery
        )
        {
            context.User = new ClaimsPrincipal(identity);
            context.IssueAntiforgeryCookie(antiforgery);
        }
    }
}
