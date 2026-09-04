using BlitzTask.Backend.Features.Shared.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace BlitzTask.Backend.Tests.Features.Shared;

/// <summary>
/// Covers how emailed links get their origin. Configuration wins over the request, and the
/// no-request case is the one that matters most: the reminder sweep runs on a timer.
/// </summary>
public class AppUrlBuilderTests
{
    private static AppUrlBuilder Build(string? baseUrl, HttpContext? context = null) =>
        new(
            Options.Create(new AppSettings { BaseUrl = baseUrl }),
            new HttpContextAccessor { HttpContext = context }
        );

    private static DefaultHttpContext RequestFrom(string scheme, string host)
    {
        var context = new DefaultHttpContext();
        context.Request.Scheme = scheme;
        context.Request.Host = new HostString(host);
        return context;
    }

    [Fact]
    public void UsesTheConfiguredBaseUrl()
    {
        Assert.Equal(
            "https://blitz.example.com/projects/1",
            Build("https://blitz.example.com").Build("/projects/1")
        );
    }

    [Fact]
    public void ConfigurationWinsOverTheRequest()
    {
        // The point of L14: a request-derived origin depends on the proxy sending
        // X-Forwarded-Proto, which is configuration this app can neither see nor test. When an
        // explicit origin exists it is the answer, whatever the request claims.
        var builder = Build("https://blitz.example.com", RequestFrom("http", "localhost:8080"));

        Assert.Equal("https://blitz.example.com/projects/1", builder.Build("/projects/1"));
    }

    [Fact]
    public void FallsBackToTheRequestWhenNotConfigured()
    {
        // Development has no App__BaseUrl and no proxy, so the request is a fine stand-in.
        var builder = Build(null, RequestFrom("http", "localhost:5121"));

        Assert.Equal("http://localhost:5121/confirm-email", builder.Build("/confirm-email"));
    }

    [Fact]
    public void ThrowsWhenThereIsNeitherConfigurationNorRequest()
    {
        // The bug this change exists for. A background job has no request, so before a
        // configured origin existed the reminder mail carried a relative href — which renders
        // as a link to nowhere.
        var exception = Assert.Throws<InvalidOperationException>(() => Build(null).Build("/projects/1"));

        Assert.Contains("App__BaseUrl", exception.Message);
    }

    [Theory]
    [InlineData("https://blitz.example.com/")]
    [InlineData("https://blitz.example.com")]
    public void ToleratesATrailingSlashOnTheConfiguredOrigin(string configured)
    {
        // Pasting a URL out of a browser bar brings the slash with it; doubling it would give
        // https://host//projects/1.
        Assert.Equal("https://blitz.example.com/projects/1", Build(configured).Build("/projects/1"));
    }

    [Fact]
    public void AcceptsAPathWithoutALeadingSlash()
    {
        Assert.Equal(
            "https://blitz.example.com/projects/1",
            Build("https://blitz.example.com").Build("projects/1")
        );
    }
}
