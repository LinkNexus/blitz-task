using System.Security.Claims;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
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

        /// <summary>
        /// A real SQLite context, unlike <see cref="CreateDbContext"/>'s in-memory provider.
        /// Use it whenever the thing under test is a LINQ query that has to survive translation
        /// to SQL — the in-memory provider evaluates anything client-side and so cannot fail
        /// the way the real provider would.
        /// </summary>
        public static ApplicationDbContext CreateSqliteDbContext()
        {
            // Kept open deliberately: an in-memory SQLite database only lives as long as its
            // connection, and EF will not close one it does not own.
            var connection = new SqliteConnection("DataSource=:memory:");
            connection.Open();

            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseSqlite(connection)
                .Options;

            var dbContext = new ApplicationDbContext(options);
            dbContext.Database.EnsureCreated();
            return dbContext;
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
