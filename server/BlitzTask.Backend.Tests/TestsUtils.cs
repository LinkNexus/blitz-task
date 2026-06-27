using System.Security.Claims;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace BlitzTask.Backend.Tests
{
    public static class TestsUtils
    {
        public static ApplicationDbContext CreateDbContext(string name)
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(name)
                .Options;
            return new ApplicationDbContext(options);
        }

        public static DefaultHttpContext CreateAuthenticatableHttpContext()
        {
            var authServiceMock = new Mock<IAuthenticationService>();
            authServiceMock
                .Setup(x =>
                    x.SignInAsync(
                        It.IsAny<HttpContext>(),
                        It.IsAny<string?>(),
                        It.IsAny<ClaimsPrincipal>(),
                        It.IsAny<AuthenticationProperties?>()
                    )
                )
                .Returns(Task.CompletedTask);

            var services = new ServiceCollection();
            services.AddSingleton(authServiceMock.Object);
            return new DefaultHttpContext { RequestServices = services.BuildServiceProvider() };
        }

        public static async Task<User> SeedUserAsync(
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
    }
}
