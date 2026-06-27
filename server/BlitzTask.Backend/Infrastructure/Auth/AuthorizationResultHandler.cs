using BlitzTask.Backend.Features.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;

namespace BlitzTask.Backend.Infrastructure.Auth
{
    public sealed class AuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
    {
        public async Task HandleAsync(
            RequestDelegate next,
            HttpContext context,
            AuthorizationPolicy policy,
            PolicyAuthorizationResult authorizeResult
        )
        {
            if (authorizeResult.Challenged)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(
                    new ApiMessageResponse(
                        "Unauthorized access. You must logged in to access this resource"
                    )
                );
                return;
            }

            if (authorizeResult.Forbidden)
            {
                var reasons = authorizeResult
                    .AuthorizationFailure?.FailureReasons.Select(r => r.Message)
                    .ToArray();

                context.Response.StatusCode = StatusCodes.Status403Forbidden;

                string message;

                if (reasons is not null && reasons.Length > 0)
                    message = reasons[0];
                else
                    message = "Forbidden access";

                await context.Response.WriteAsJsonAsync(
                    new { Type = "Authorization", Message = message }
                );

                return;
            }

            await next(context);
        }
    }
}
