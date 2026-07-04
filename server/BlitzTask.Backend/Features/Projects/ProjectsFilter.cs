using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Projects
{
    public class RequireProjectPermissionFilter(ProjectPermission? permission = null)
        : IEndpointFilter
    {
        public async ValueTask<object?> InvokeAsync(
            EndpointFilterInvocationContext context,
            EndpointFilterDelegate next
        )
        {
            var dbContext =
                context.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();

            var user = context.HttpContext.GetUser();
            var projectIdStr = context.HttpContext.Request.RouteValues["projectId"]?.ToString();

            if (projectIdStr is null)
            {
                return Results.BadRequest(new ApiMessageResponse("Project ID is required."));
            }

            if (!int.TryParse(projectIdStr, out var projectId))
            {
                return Results.BadRequest(new ApiMessageResponse("Invalid project ID."));
            }

            var participant = await dbContext
                .ProjectParticipants.Where(pp => pp.ProjectId == projectId && pp.UserId == user.Id)
                .FirstOrDefaultAsync();

            if (participant is null)
            {
                return Results.NotFound(new ApiMessageResponse("Project not found."));
            }

            if (permission.HasValue && !participant.Role.HasPermission(permission.Value))
            {
                return Results.Json(
                    new ApiMessageResponse(
                        "You do not have permission to do this action or access this resource"
                    ),
                    statusCode: StatusCodes.Status403Forbidden
                );
            }

            context.HttpContext.Items["ProjectParticipant"] = participant;
            return await next(context);
        }
    }
}
