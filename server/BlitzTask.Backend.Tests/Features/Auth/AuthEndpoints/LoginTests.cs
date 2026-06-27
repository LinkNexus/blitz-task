using BlitzTask.Backend.Features.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Tests.Features.Auth.AuthEndpoints;

public class LoginTests
{
    [Fact]
    public async Task Login_Returns401_WhenUserDoesNotExist()
    {
        using var dbContext = TestsUtils.CreateDbContext(
            nameof(Login_Returns401_WhenUserDoesNotExist)
        );
        var httpContext = TestsUtils.CreateAuthenticatableHttpContext();

        var result = await Backend.Features.Auth.AuthEndpoints.Login(
            new LoginRequest("nonexistent@example.com", "password", false),
            dbContext,
            httpContext
        );

        var statusResult = Assert.IsType<IStatusCodeHttpResult>(result, exactMatch: false);
        Assert.Equal(StatusCodes.Status401Unauthorized, statusResult.StatusCode);
    }

    [Fact]
    public async Task Login_Returns401_WhenPasswordIsIncorrect()
    {
        using var dbContext = TestsUtils.CreateDbContext(
            nameof(Login_Returns401_WhenPasswordIsIncorrect)
        );
        await TestsUtils.SeedUserAsync(dbContext, password: "correctpassword");
        var httpContext = TestsUtils.CreateAuthenticatableHttpContext();

        var result = await Backend.Features.Auth.AuthEndpoints.Login(
            new LoginRequest("user@example.com", "wrongpassword", false),
            dbContext,
            httpContext
        );

        var statusResult = Assert.IsType<IStatusCodeHttpResult>(result, exactMatch: false);
        Assert.Equal(StatusCodes.Status401Unauthorized, statusResult.StatusCode);
    }

    [Fact]
    public async Task Login_Returns200WithCurrentUser_WhenCredentialsAreValid()
    {
        using var dbContext = TestsUtils.CreateDbContext(
            nameof(Login_Returns200WithCurrentUser_WhenCredentialsAreValid)
        );
        var user = await TestsUtils.SeedUserAsync(dbContext, password: "correctpassword");
        var httpContext = TestsUtils.CreateAuthenticatableHttpContext();

        var result = await Backend.Features.Auth.AuthEndpoints.Login(
            new LoginRequest("user@example.com", "correctpassword", false),
            dbContext,
            httpContext
        );

        var valueResult = Assert.IsType<IValueHttpResult>(result, exactMatch: false);
        var currentUser = Assert.IsType<CurrentUser>(valueResult.Value);
        Assert.Equal(user.Email, currentUser.Email);
        Assert.Equal(user.Name, currentUser.Name);
    }

    [Fact]
    public async Task Login_CreatesSecurityStampToken_WhenNoneExists()
    {
        using var dbContext = TestsUtils.CreateDbContext(
            nameof(Login_CreatesSecurityStampToken_WhenNoneExists)
        );
        await TestsUtils.SeedUserAsync(dbContext, password: "password123");
        var httpContext = TestsUtils.CreateAuthenticatableHttpContext();

        await Backend.Features.Auth.AuthEndpoints.Login(
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
        using var dbContext = TestsUtils.CreateDbContext(
            nameof(Login_ReusesExistingSecurityStampToken_WhenOneAlreadyExists)
        );
        var user = await TestsUtils.SeedUserAsync(dbContext, password: "password123");

        dbContext.UserTokens.Add(
            new UserToken
            {
                UserId = user.Id,
                Value = "existing-stamp",
                Type = UserTokenType.SecurityStamp,
            }
        );
        await dbContext.SaveChangesAsync();

        var httpContext = TestsUtils.CreateAuthenticatableHttpContext();
        await Backend.Features.Auth.AuthEndpoints.Login(
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
