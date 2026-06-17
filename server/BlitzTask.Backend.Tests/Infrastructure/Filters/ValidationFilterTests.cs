using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace BlitzTask.Backend.Tests.Infrastructure.Filters;

public class ValidationFilterTests
{
    private static DefaultHttpContext CreateHttpContext(Action<ServiceCollection>? configure = null)
    {
        var services = new ServiceCollection();
        configure?.Invoke(services);
        return new DefaultHttpContext { RequestServices = services.BuildServiceProvider() };
    }

    private static Mock<EndpointFilterInvocationContext> CreateMockFilterContext(
        HttpContext httpContext,
        params object?[] args
    )
    {
        var mock = new Mock<EndpointFilterInvocationContext>();
        mock.Setup(c => c.HttpContext).Returns(httpContext);
        mock.Setup(c => c.Arguments).Returns(new List<object?>(args));
        return mock;
    }

    [Fact]
    public async Task InvokeAsync_CallsNext_WhenNoValidatorIsRegistered()
    {
        var httpContext = CreateHttpContext();
        var filterContext = CreateMockFilterContext(
            httpContext,
            new LoginRequest("test@test.com", "pass", false)
        );
        var nextCalled = false;
        EndpointFilterDelegate next = _ =>
        {
            nextCalled = true;
            return ValueTask.FromResult<object?>(null);
        };

        await ValidationFilter<LoginRequest>.Body().InvokeAsync(filterContext.Object, next);

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task InvokeAsync_CallsNext_WhenNoMatchingArgumentFound()
    {
        var httpContext = CreateHttpContext(services =>
            services.AddSingleton<IValidator<LoginRequest>>(new LoginRequestValidator())
        );
        var filterContext = CreateMockFilterContext(httpContext); // no arguments
        var nextCalled = false;
        EndpointFilterDelegate next = _ =>
        {
            nextCalled = true;
            return ValueTask.FromResult<object?>(null);
        };

        await ValidationFilter<LoginRequest>.Body().InvokeAsync(filterContext.Object, next);

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task InvokeAsync_Returns422_WhenValidationFails()
    {
        var httpContext = CreateHttpContext(services =>
            services.AddSingleton<IValidator<LoginRequest>>(new LoginRequestValidator())
        );
        var filterContext = CreateMockFilterContext(
            httpContext,
            new LoginRequest("not-an-email", "", false)
        );
        EndpointFilterDelegate next = _ => ValueTask.FromResult<object?>(Results.Ok());

        var result = await ValidationFilter<LoginRequest>
            .Body()
            .InvokeAsync(filterContext.Object, next);

        var statusResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status422UnprocessableEntity, statusResult.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_Returns422WithBodyErrors_WhenBodyValidationFails()
    {
        var httpContext = CreateHttpContext(services =>
            services.AddSingleton<IValidator<LoginRequest>>(new LoginRequestValidator())
        );
        var filterContext = CreateMockFilterContext(
            httpContext,
            new LoginRequest("not-an-email", "", false)
        );
        EndpointFilterDelegate next = _ => ValueTask.FromResult<object?>(Results.Ok());

        var result = await ValidationFilter<LoginRequest>
            .Body()
            .InvokeAsync(filterContext.Object, next);

        var valueResult = Assert.IsAssignableFrom<IValueHttpResult>(result);
        var errors = Assert.IsType<ValidationErrors>(valueResult.Value);
        Assert.Equal("body", errors.On);
        Assert.NotEmpty(errors.Errors);
    }

    [Fact]
    public async Task InvokeAsync_CallsNext_WhenValidationPasses()
    {
        var httpContext = CreateHttpContext(services =>
            services.AddSingleton<IValidator<LoginRequest>>(new LoginRequestValidator())
        );
        var filterContext = CreateMockFilterContext(
            httpContext,
            new LoginRequest("valid@example.com", "strongpassword", false)
        );
        var nextCalled = false;
        EndpointFilterDelegate next = _ =>
        {
            nextCalled = true;
            return ValueTask.FromResult<object?>(null);
        };

        await ValidationFilter<LoginRequest>.Body().InvokeAsync(filterContext.Object, next);

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task InvokeAsync_ReturnsErrorsWithCorrectFieldPaths_WhenValidationFails()
    {
        var httpContext = CreateHttpContext(services =>
            services.AddSingleton<IValidator<LoginRequest>>(new LoginRequestValidator())
        );
        var filterContext = CreateMockFilterContext(
            httpContext,
            new LoginRequest("not-an-email", "", false)
        );
        EndpointFilterDelegate next = _ => ValueTask.FromResult<object?>(Results.Ok());

        var result = await ValidationFilter<LoginRequest>
            .Body()
            .InvokeAsync(filterContext.Object, next);

        var valueResult = Assert.IsAssignableFrom<IValueHttpResult>(result);
        var errors = Assert.IsType<ValidationErrors>(valueResult.Value);
        var paths = errors.Errors.Select(e => e.Path).ToList();
        Assert.Contains("Email", paths);
        Assert.Contains("Password", paths);
    }
}
