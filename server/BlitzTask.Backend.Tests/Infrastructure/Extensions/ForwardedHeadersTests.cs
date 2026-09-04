using BlitzTask.Backend.Features.Shared.Services;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace BlitzTask.Backend.Tests.Infrastructure.Extensions;

/// <summary>
/// Covers the reverse-proxy scheme/host rewrite behind every emailed link.
/// <para>
/// Worth a test rather than a code review because **the failure is silent**: with the default
/// options ASP.NET parses the forwarded headers and then discards them, because it only trusts
/// proxies on loopback and Traefik reaches the container over a Docker network. Nothing throws,
/// nothing logs at warning — the links just come out <c>http://</c>. These tests run the real
/// <see cref="ForwardedHeadersSetup.Configure"/>, so deleting the KnownProxies clearing fails
/// them.
/// </para>
/// </summary>
public class ForwardedHeadersTests
{
    private static async Task<HttpContext> ThroughMiddlewareAsync(
        Action<HttpContext> arrange,
        Action<ForwardedHeadersOptions>? configure = null
    )
    {
        var options = new ForwardedHeadersOptions();
        (configure ?? ForwardedHeadersSetup.Configure)(options);

        var context = new DefaultHttpContext();
        context.Request.Scheme = "http";
        context.Request.Host = new HostString("localhost:8080");
        // A non-loopback peer, as Traefik is: this is exactly what the default trust list
        // rejects, so a test using 127.0.0.1 would pass either way and prove nothing.
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("10.0.1.7");
        arrange(context);

        var middleware = new ForwardedHeadersMiddleware(
            _ => Task.CompletedTask,
            NullLoggerFactory.Instance,
            Options.Create(options)
        );
        await middleware.Invoke(context);
        return context;
    }

    [Fact]
    public async Task RewritesSchemeFromXForwardedProto()
    {
        var context = await ThroughMiddlewareAsync(c =>
            c.Request.Headers["X-Forwarded-Proto"] = "https"
        );

        Assert.Equal("https", context.Request.Scheme);
    }

    [Fact]
    public async Task RewritesHostFromXForwardedHost()
    {
        var context = await ThroughMiddlewareAsync(c =>
        {
            c.Request.Headers["X-Forwarded-Proto"] = "https";
            c.Request.Headers["X-Forwarded-Host"] = "blitz.example.com";
        });

        Assert.Equal("blitz.example.com", context.Request.Host.Value);
    }

    [Fact]
    public async Task EmailedLinksComeOutHttps_BehindTheProxy()
    {
        // The end the whole change exists for (ROADMAP L14).
        var context = await ThroughMiddlewareAsync(c =>
        {
            c.Request.Headers["X-Forwarded-Proto"] = "https";
            c.Request.Headers["X-Forwarded-Host"] = "blitz.example.com";
        });

        // With no App__BaseUrl configured the origin comes off the request, which is the
        // development path — and the one that depends on this middleware having run.
        var urlBuilder = new AppUrlBuilder(
            Options.Create(new AppSettings()),
            new HttpContextAccessor { HttpContext = context }
        );

        Assert.Equal(
            "https://blitz.example.com/confirm-email?token=abc&userId=1",
            urlBuilder.Build("/confirm-email?token=abc&userId=1")
        );
    }

    [Fact]
    public async Task DefaultOptions_SilentlyIgnoreTheHeaders()
    {
        // Pins the reason ForwardedHeadersSetup clears KnownNetworks/KnownProxies. The default
        // trust list is loopback only, so a proxy on a Docker network is ignored — without a
        // throw or an error log, which is what makes this worth pinning rather than reviewing.
        var context = await ThroughMiddlewareAsync(
            c => c.Request.Headers["X-Forwarded-Proto"] = "https",
            options => options.ForwardedHeaders = ForwardedHeaders.XForwardedProto
        );

        Assert.Equal("http", context.Request.Scheme);
    }

    [Fact]
    public async Task LeavesTheRequestAlone_WhenNothingIsForwarded()
    {
        // Development runs with no proxy in front of it and must be unaffected.
        var context = await ThroughMiddlewareAsync(_ => { });

        Assert.Equal("http", context.Request.Scheme);
        Assert.Equal("localhost:8080", context.Request.Host.Value);
    }

}
