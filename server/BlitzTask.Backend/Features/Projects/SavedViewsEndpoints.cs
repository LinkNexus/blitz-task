using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Projects
{
    public static class SavedViewsEndpoints
    {
        public static IEndpointRouteBuilder MapSavedViewsEndpoints(this IEndpointRouteBuilder app)
        {
            // Membership is the whole check, with no permission attached — the same reasoning as
            // a task reminder. A saved view is the caller's own way of reading the board, so a
            // Viewer may keep one even though they may change nothing on it.
            var group = app.MapGroup("/api/{projectId:int}/views")
                .WithTags("Saved Views")
                .RequireAuthorization("EmailConfirmed")
                .AddEndpointFilter(new RequireProjectPermissionFilter());

            group
                .MapGet("", ListSavedViews)
                .WithName("list-saved-views")
                .Produces<List<SavedViewDetails>>();

            group
                .MapPost("", CreateSavedView)
                .WithName("create-saved-view")
                .AddEndpointFilter(ValidationFilter<CreateSavedViewRequest>.Body())
                .Produces<SavedViewDetails>(StatusCodes.Status201Created)
                .Produces<ApiMessageResponse>(StatusCodes.Status409Conflict)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapPatch("/{viewId:int}", UpdateSavedView)
                .WithName("update-saved-view")
                .AddEndpointFilter(ValidationFilter<UpdateSavedViewRequest>.Body())
                .Produces<SavedViewDetails>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ApiMessageResponse>(StatusCodes.Status409Conflict)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapDelete("/{viewId:int}", DeleteSavedView)
                .WithName("delete-saved-view")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            return app;
        }

        public static async Task<Ok<List<SavedViewDetails>>> ListSavedViews(
            int projectId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var views = await dbContext
                .SavedViews.Where(v => v.ProjectId == projectId && v.UserId == user.Id)
                .OrderBy(v => v.Name)
                .Select(v => new SavedViewDetails(v.Id, v.Name, v.Search))
                .ToListAsync(cancellationToken);

            return TypedResults.Ok(views);
        }

        public static async Task<
            Results<JsonHttpResult<SavedViewDetails>, Conflict<ApiMessageResponse>>
        > CreateSavedView(
            int projectId,
            CreateSavedViewRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();
            var name = request.Name.Trim();

            if (await NameTakenAsync(dbContext, projectId, user.Id, name, null, cancellationToken))
            {
                return TypedResults.Conflict(
                    new ApiMessageResponse("You already have a view with that name")
                );
            }

            var view = new SavedView
            {
                ProjectId = projectId,
                UserId = user.Id,
                Name = name,
                Search = request.Search,
            };

            dbContext.SavedViews.Add(view);
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Json(
                new SavedViewDetails(view.Id, view.Name, view.Search),
                statusCode: StatusCodes.Status201Created
            );
        }

        public static async Task<
            Results<
                Ok<SavedViewDetails>,
                NotFound<ApiMessageResponse>,
                Conflict<ApiMessageResponse>
            >
        > UpdateSavedView(
            int projectId,
            int viewId,
            UpdateSavedViewRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            // Scoped to the caller, so another member's view reads as absent rather than
            // forbidden — there is no way to learn it exists.
            var view = await dbContext.SavedViews.FirstOrDefaultAsync(
                v => v.Id == viewId && v.ProjectId == projectId && v.UserId == user.Id,
                cancellationToken
            );

            if (view is null)
                return TypedResults.NotFound(new ApiMessageResponse("View not found"));

            var name = request.Name.Trim();

            if (
                await NameTakenAsync(dbContext, projectId, user.Id, name, viewId, cancellationToken)
            )
            {
                return TypedResults.Conflict(
                    new ApiMessageResponse("You already have a view with that name")
                );
            }

            view.Name = name;
            view.Search = request.Search;
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Ok(new SavedViewDetails(view.Id, view.Name, view.Search));
        }

        public static async Task<Results<NoContent, NotFound<ApiMessageResponse>>> DeleteSavedView(
            int projectId,
            int viewId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var deleted = await dbContext
                .SavedViews.Where(v =>
                    v.Id == viewId && v.ProjectId == projectId && v.UserId == user.Id
                )
                .ExecuteDeleteAsync(cancellationToken);

            return deleted == 0
                ? TypedResults.NotFound(new ApiMessageResponse("View not found"))
                : TypedResults.NoContent();
        }

        /// <summary>
        /// The unique index is the real guarantee; this exists so the collision comes back as a
        /// sentence rather than as a 500 from the constraint.
        /// </summary>
        private static Task<bool> NameTakenAsync(
            ApplicationDbContext dbContext,
            int projectId,
            int userId,
            string name,
            int? excludingViewId,
            CancellationToken cancellationToken
        ) =>
            dbContext.SavedViews.AnyAsync(
                v =>
                    v.ProjectId == projectId
                    && v.UserId == userId
                    && v.Name == name
                    && (excludingViewId == null || v.Id != excludingViewId),
                cancellationToken
            );
    }
}
