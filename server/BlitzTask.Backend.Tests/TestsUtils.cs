using System.Security.Claims;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Antiforgery;
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

        /// <summary>
        /// An <see cref="IAntiforgery"/> that records the identity in force at the moment a token
        /// was minted.
        /// <para>
        /// That is the whole assertion for L48.5. A token is bound to the signing-in user's name
        /// claim, and <c>SignInAsync</c> leaves <see cref="HttpContext.User"/> describing the
        /// *previous* identity for the rest of the request — so re-issuing without replacing it
        /// first mints a token for the user we just stopped being, which looks like a fix and
        /// fails in exactly the same way.
        /// </para>
        /// </summary>
        public sealed class RecordingAntiforgery : IAntiforgery
        {
            /// <summary>Name claims captured at each <c>GetAndStoreTokens</c>, in order.</summary>
            public List<string?> IssuedFor { get; } = [];

            public AntiforgeryTokenSet GetAndStoreTokens(HttpContext httpContext)
            {
                IssuedFor.Add(httpContext.User?.Identity?.Name);
                return GetTokens(httpContext);
            }

            public AntiforgeryTokenSet GetTokens(HttpContext httpContext) =>
                new("request-token", "cookie-token", "__RequestVerificationToken", "X-XSRF-TOKEN");

            public Task<bool> IsRequestValidAsync(HttpContext httpContext) => Task.FromResult(true);

            public Task ValidateRequestAsync(HttpContext httpContext) => Task.CompletedTask;

            public void SetCookieTokenAndHeader(HttpContext httpContext) { }
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
