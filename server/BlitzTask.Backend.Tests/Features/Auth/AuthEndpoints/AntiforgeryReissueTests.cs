using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace BlitzTask.Backend.Tests.Features.Auth.AuthEndpoints;

/// <summary>
/// The antiforgery token is re-issued whenever the signed-in identity changes (L48.5).
/// <para>
/// This is a regression lock on a bug that made a brand-new account able to read everything and
/// save nothing. The request token embeds the identity's name claim; the SPA fetches one on boot
/// and <c>ensureCsrfToken</c> then skips the fetch for as long as the cookie exists, so signing
/// in — which neither clears the cookie nor reloads the page — left the caller holding a token
/// minted for nobody. Every <i>form</i> endpoint after that answered 400 with "the provided
/// antiforgery token was meant for a different claims-based user", which names the symptom and
/// not the sign-in that caused it.
/// </para>
/// <para>
/// Only the server can notice the identity changed, so the fix lives at the three transitions
/// below. The client needs no change: its interceptor reads the cookie fresh on every request.
/// </para>
/// </summary>
public class AntiforgeryReissueTests
{
    private static async Task<(DefaultHttpContext Context, TestsUtils.RecordingAntiforgery Antiforgery)> SignInAsync(
        string email,
        string name = "Test User"
    )
    {
        using var dbContext = TestsUtils.CreateDbContext(Guid.NewGuid().ToString());
        var user = await TestsUtils.SeedUserAsync(dbContext, email);
        user.Name = name;
        await dbContext.SaveChangesAsync();
        var context = TestsUtils.CreateAuthenticatableHttpContext();
        var antiforgery = new TestsUtils.RecordingAntiforgery();

        var result = await Backend.Features.Auth.AuthEndpoints.Login(
            new LoginRequest(email, "password123", false),
            dbContext,
            context,
            antiforgery
        );

        // `Ok<CurrentUser>` is itself an `IStatusCodeHttpResult`, so the success check has to
        // name the success type rather than assert the absence of a status result.
        Assert.IsType<Ok<CurrentUser>>(result);

        return (context, antiforgery);
    }

    [Fact]
    public async Task LoggingInMintsAFreshTokenAndWritesItToTheCookie()
    {
        var (context, antiforgery) = await SignInAsync("signs-in@example.com");

        Assert.Single(antiforgery.IssuedFor);
        Assert.Contains(
            context.Response.Headers.SetCookie,
            header => header!.StartsWith($"{AntiforgeryExtensions.RequestTokenCookie}=")
        );
    }

    [Fact]
    public async Task TheTokenIsMintedForTheUserBeingSignedInRatherThanTheOneBeingReplaced()
    {
        // The subtle half, and the one a naive fix gets wrong. `SignInAsync` writes the auth
        // cookie to the *response*; `HttpContext.User` keeps describing the previous identity for
        // the rest of the request. Minting without replacing it first produces a token for
        // whoever the caller was a moment ago — which is the original bug, reintroduced by the
        // code that was supposed to fix it, and indistinguishable from it at runtime.
        var (_, antiforgery) = await SignInAsync("becomes-me@example.com", name: "Becomes Me");

        // The name claim is what the token binds to, and it is `user.Name` — so this is the
        // identity the *new* session has, not the empty one the request arrived with.
        Assert.Equal("Becomes Me", antiforgery.IssuedFor.Single());
    }

    [Fact]
    public async Task LoggingOutMintsAnAnonymousTokenForWhoeverSignsInNext()
    {
        var context = TestsUtils.CreateAuthenticatableHttpContext();
        var antiforgery = new TestsUtils.RecordingAntiforgery();

        await Backend.Features.Auth.AuthEndpoints.Logout(context, antiforgery);

        // Left alone, the token still names the person who just left, so the next form write from
        // the same page — signing in as somebody else, most obviously — is rejected for a reason
        // that has nothing to do with the request.
        Assert.Null(antiforgery.IssuedFor.Single());
        Assert.Contains(
            context.Response.Headers.SetCookie,
            header => header!.StartsWith($"{AntiforgeryExtensions.RequestTokenCookie}=")
        );
    }
}
