using System.Security.Claims;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Infrastructure.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;

namespace BlitzTask.Backend.Tests.Infrastructure.Auth;

public class EmailConfirmedHandlerTests
{
    private readonly EmailConfirmedHandler _handler = new();
    private readonly EmailConfirmedRequirement _requirement = new();

    private static User MakeUser(bool emailConfirmed) => new()
    {
        Name = "Test",
        Email = "test@example.com",
        Password = "hashed",
        EmailConfirmed = emailConfirmed,
    };

    [Fact]
    public async Task HandleAsync_Succeeds_WhenUserEmailIsConfirmed()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["CurrentUser"] = MakeUser(emailConfirmed: true);

        var context = new AuthorizationHandlerContext(
            [_requirement],
            new ClaimsPrincipal(),
            httpContext
        );

        await _handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task HandleAsync_DoesNotSucceed_WhenUserEmailIsNotConfirmed()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["CurrentUser"] = MakeUser(emailConfirmed: false);

        var context = new AuthorizationHandlerContext(
            [_requirement],
            new ClaimsPrincipal(),
            httpContext
        );

        await _handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task HandleAsync_DoesNotSucceed_WhenCurrentUserNotInHttpContext()
    {
        var httpContext = new DefaultHttpContext();

        var context = new AuthorizationHandlerContext(
            [_requirement],
            new ClaimsPrincipal(),
            httpContext
        );

        await _handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task HandleAsync_DoesNotSucceed_WhenResourceIsNotHttpContext()
    {
        var context = new AuthorizationHandlerContext(
            [_requirement],
            new ClaimsPrincipal(),
            resource: null
        );

        await _handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }
}
