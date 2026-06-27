namespace BlitzTask.Backend.Tests.Features.Auth.AuthEndpoints
{
    public class CreateAccountTests
    {
        public async Task CreateAccount_Returns422_WhenEmailIsAlreadyInUse()
        {
            using var dbContext = TestsUtils.CreateDbContext(
                nameof(CreateAccount_Returns422_WhenEmailIsAlreadyInUse)
            );
            var httpContext = TestsUtils.CreateAuthenticatableHttpContext();
            var user = await TestsUtils.SeedUserAsync(dbContext);

            // var result = await Backend.Features.Auth.AuthEndpoints.CreateAccount(
            //     new CreateAccountRequest("")
            // );
        }
    }
}
