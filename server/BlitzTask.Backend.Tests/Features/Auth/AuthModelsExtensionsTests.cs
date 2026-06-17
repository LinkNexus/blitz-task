using BlitzTask.Backend.Features.Auth;

namespace BlitzTask.Backend.Tests.Features.Auth;

public class AuthModelsExtensionsTests
{
    [Fact]
    public void ToCurrentUser_Should_MapAllPropertiesCorrectly()
    {
        var now = DateTime.UtcNow;
        var user = new User
        {
            Id = 42,
            Name = "Jane Doe",
            Email = "jane@example.com",
            Password = "hashed-password",
            EmailConfirmed = true,
            CreatedAt = now.AddDays(-10),
            UpdatedAt = now,
        };

        var currentUser = user.ToCurrentUser();

        Assert.Equal(user.Id, currentUser.Id);
        Assert.Equal(user.Name, currentUser.Name);
        Assert.Equal(user.Email, currentUser.Email);
        Assert.Equal(user.EmailConfirmed, currentUser.EmailConfirmed);
        Assert.Equal(user.CreatedAt, currentUser.CreatedAt);
        Assert.Equal(user.UpdatedAt, currentUser.UpdatedAt);
    }

    [Fact]
    public void ToCurrentUser_Should_NotExposePassword()
    {
        var properties = typeof(CurrentUser).GetProperties();
        Assert.DoesNotContain(properties, p => p.Name == "Password");
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void ToCurrentUser_Should_PreserveEmailConfirmedStatus(bool emailConfirmed)
    {
        var user = new User
        {
            Id = 1,
            Name = "Test",
            Email = "test@example.com",
            Password = "hashed",
            EmailConfirmed = emailConfirmed,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        var currentUser = user.ToCurrentUser();

        Assert.Equal(emailConfirmed, currentUser.EmailConfirmed);
    }
}
