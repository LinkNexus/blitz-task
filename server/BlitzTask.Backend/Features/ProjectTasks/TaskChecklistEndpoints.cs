using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public static class TaskChecklistEndpoints
    {
        public static IEndpointRouteBuilder MapTaskChecklistEndpoints(this IEndpointRouteBuilder app)
        {
            // Ticking is the one checklist write that does not go through the task's own form.
            // Everything else about a checklist — the items, their text, their order — rides on
            // the task request the way Tags do, so that a task being created for the first time
            // can still be given one. But the ticked state has to survive a save it did not take
            // part in, and a checkbox that only persists when you afterwards press "Save changes"
            // is the friction that stops a checklist being used at all.
            var group = app.MapGroup("/api/{projectId:int}/tasks/{taskId:int}/checklist")
                .WithTags("Task Checklist")
                .RequireAuthorization("EmailConfirmed")
                .AddEndpointFilter(new RequireProjectPermissionFilter(ProjectPermission.ManageTasks));

            group
                .MapPatch("/{itemId:int}", SetItemDone)
                .WithName("set-checklist-item-done")
                .Produces<ChecklistItemDetails>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            return app;
        }

        public static async Task<
            Results<Ok<ChecklistItemDetails>, NotFound<ApiMessageResponse>>
        > SetItemDone(
            int projectId,
            int taskId,
            int itemId,
            SetChecklistItemDoneRequest request,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            // The project is matched through the task rather than trusted from the route: the
            // permission filter authorised {projectId}, so an item reached under a project it
            // does not belong to must not resolve.
            var item = await dbContext
                .TaskChecklistItems.Where(c =>
                    c.Id == itemId
                    && c.ProjectTaskId == taskId
                    && c.ProjectTask.RelatedProjectId == projectId
                )
                .FirstOrDefaultAsync(cancellationToken);

            if (item is null)
                return TypedResults.NotFound(new ApiMessageResponse("Checklist item not found"));

            item.IsDone = request.IsDone;
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Ok(
                new ChecklistItemDetails(item.Id, item.Text, item.IsDone, item.Position)
            );
        }
    }
}
