using System.Security.Claims;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace BlitzTask.Backend.Tests.Features.Auth;

public class AuthEndpointsLoginTests
{
    private static ApplicationDbContext CreateDbContext(string name)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new ApplicationDbContext(options);
    }

    private static HttpContext CreateAuthenticatableHttpContext()
    {
        var authServiceMock = new Mock<IAuthenticationService>();
        authServiceMock
            .Setup(x => x.SignInAsync(
                It.IsAny<HttpContext>(),
                It.IsAny<string?>(),
                It.IsAny<ClaimsPrincipal>(),
                It.IsAny<AuthenticationProperties?>()
            ))
            .Returns(Task.CompletedTask);

        var services = new ServiceCollection();
        services.AddSingleton(authServiceMock.Object);
        return new DefaultHttpContext { RequestServices = services.BuildServiceProvider() };
    }

    private static async Task<User> SeedUserAsync(
        ApplicationDbContext dbContext,
        string email = "user@example.com",
        string password = "password123"
    )
    {
        var user = new User
        {
            Name = "Test User",
            Email = email,
            Password = "placeholder",
            EmailConfirmed = true,
        };
        var hasher = new PasswordHasher<User>();
        user.Password = hasher.HashPassword(user, password);
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task Login_Returns401_WhenUserDoesNotExist()
    {
        using var dbContext = CreateDbContext(nameof(Login_Returns401_WhenUserDoesNotExist));
        var httpContext = CreateAuthenticatableHttpContext();

        var result = await AuthEndpoints.Login(
            new LoginRequest("nonexistent@example.com", "password", false),
            dbContext,
            httpContext
        );

        var statusResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status401Unauthorized, statusResult.StatusCode);
    }

    [Fact]
    public async Task Login_Returns401_WhenPasswordIsIncorrect()
    {
        using var dbContext = CreateDbContext(nameof(Login_Returns401_WhenPasswordIsIncorrect));
        await SeedUserAsync(dbContext, password: "correctpassword");
        var httpContext = CreateAuthenticatableHttpContext();

        var result = await AuthEndpoints.Login(
            new LoginRequest("user@example.com", "wrongpassword", false),
            dbContext,
            httpContext
        );

        var statusResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status401Unauthorized, statusResult.StatusCode);
    }

    [Fact]
    public async Task Login_Returns200WithCurrentUser_WhenCredentialsAreValid()
    {
        using var dbContext = CreateDbContext(nameof(Login_Returns200WithCurrentUser_WhenCredentialsAreValid));
        var user = await SeedUserAsync(dbContext, password: "correctpassword");
        var httpContext = CreateAuthenticatableHttpContext();

        var result = await AuthEndpoints.Login(
            new LoginRequest("user@example.com", "correctpassword", false),
            dbContext,
            httpContext
        );

        var valueResult = Assert.IsAssignableFrom<IValueHttpResult>(result);
        var currentUser = Assert.IsType<CurrentUser>(valueResult.Value);
        Assert.Equal(user.Email, currentUser.Email);
        Assert.Equal(user.Name, currentUser.Name);
    }

    [Fact]
    public async Task Login_CreatesSecurityStampToken_WhenNoneExists()
    {
        using var dbContext = CreateDbContext(nameof(Login_CreatesSecurityStampToken_WhenNoneExists));
        await SeedUserAsync(dbContext, password: "password123");
        var httpContext = CreateAuthenticatableHttpContext();

        await AuthEndpoints.Login(
            new LoginRequest("user@example.com", "password123", false),
            dbContext,
            httpContext
        );

        var tokenExists = await dbContext.UserTokens.AnyAsync(t =>
            t.Type == UserTokenType.SecurityStamp
        );
        Assert.True(tokenExists);
    }

    [Fact]
    public async Task Login_ReusesExistingSecurityStampToken_WhenOneAlreadyExists()
    {
        using var dbContext = CreateDbContext(nameof(Login_ReusesExistingSecurityStampToken_WhenOneAlreadyExists));
        var user = await SeedUserAsync(dbContext, password: "password123");

        dbContext.UserTokens.Add(new UserToken
        {
            UserId = user.Id,
            Value = "existing-stamp",
            Type = UserTokenType.SecurityStamp,
        });
        await dbContext.SaveChangesAsync();

        var httpContext = CreateAuthenticatableHttpContext();
        await AuthEndpoints.Login(
            new LoginRequest("user@example.com", "password123", false),
            dbContext,
            httpContext
        );

        var stampCount = await dbContext.UserTokens.CountAsync(t =>
            t.Type == UserTokenType.SecurityStamp
        );
        Assert.Equal(1, stampCount);
    }
}
