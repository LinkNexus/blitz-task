using BlitzTask.Backend.Features.Auth;
using Microsoft.AspNetCore.Authorization;

namespace BlitzTask.Backend.Infrastructure.Auth
{
    public class EmailConfirmedRequirement : IAuthorizationRequirement { }

    public class EmailConfirmedHandler : AuthorizationHandler<EmailConfirmedRequirement>
    {
        protected override async Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            EmailConfirmedRequirement requirement
        )
        {
            if (context.Resource is HttpContext httpContext)
            {
                if (
                    httpContext.Items.TryGetValue("CurrentUser", out var userObj)
                    && userObj is User user
                    && user.EmailConfirmed
                )
                {
                    context.Succeed(requirement);
                    return;
                }
            }

            context.Fail(
                new AuthorizationFailureReason(
                    this,
                    "Your email address must be confirmed in order to access this resource"
                )
            );
        }
    }
}
