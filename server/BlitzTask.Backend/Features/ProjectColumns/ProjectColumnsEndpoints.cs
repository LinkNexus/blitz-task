using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.ProjectColumns
{
    public static class ProjectColumnsEndpoints
    {
        public static IEndpointRouteBuilder MapProjectColumnsEndpoints(
            this IEndpointRouteBuilder app
        )
        {
            var group = app.MapGroup("/api/{projectId:int}/columns")
                .WithTags("Project Columns")
                .RequireAuthorization("EmailConfirmed");

            group
                .MapPost("", CreateColumn)
                .WithName("create-project-column")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageColumns)
                )
                .AddEndpointFilter(ValidationFilter<CreateProjectColumnRequest>.Body())
                .Produces<ProjectColumnDetails>(StatusCodes.Status201Created)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapPut("/{columnId:int}", UpdateColumn)
                .WithName("update-project-column")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageColumns)
                )
                .AddEndpointFilter(ValidationFilter<UpdateProjectColumnRequest>.Body())
                .Produces<ProjectColumnDetails>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapPatch("/{columnId:int}/move", MoveColumn)
                .WithName("move-project-column")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageColumns)
                )
                .AddEndpointFilter(ValidationFilter<MoveProjectColumnRequest>.Body())
                .Produces<ProjectColumnDetails>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapDelete("/{columnId:int}", DeleteColumn)
                .WithName("delete-project-column")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageColumns)
                )
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            return app;
        }

        public static async Task<
            Results<JsonHttpResult<ProjectColumnDetails>, NotFound<ApiMessageResponse>>
        > CreateColumn(
            int projectId,
            CreateProjectColumnRequest request,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var projectExists = await dbContext.Projects.AnyAsync(
                p => p.Id == projectId,
                cancellationToken
            );

            if (!projectExists)
                return TypedResults.NotFound(new ApiMessageResponse("Project not found"));

            var column = new ProjectColumn
            {
                ProjectId = projectId,
                Color = request.Color,
                Name = request.Name,
                Score = request.Score,
            };

            await dbContext.ProjectColumns.AddAsync(column, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Json(
                new ProjectColumnDetails(
                    column.Id,
                    column.Name,
                    column.Score,
                    column.Color,
                    column.CreatedAt,
                    column.UpdatedAt,
                    []
                ),
                statusCode: StatusCodes.Status201Created
            );
        }

        public static async Task<
            Results<Ok<ProjectColumnDetails>, NotFound<ApiMessageResponse>>
        > UpdateColumn(
            int projectId,
            int columnId,
            UpdateProjectColumnRequest request,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var column = await dbContext
                .ProjectColumns.Where(c => c.Id == columnId && c.ProjectId == projectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (column is null)
                return TypedResults.NotFound(new ApiMessageResponse("Column not found"));

            column.Name = request.Name;
            column.Color = request.Color;
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Ok(
                new ProjectColumnDetails(
                    column.Id,
                    column.Name,
                    column.Score,
                    column.Color,
                    column.CreatedAt,
                    column.UpdatedAt,
                    []
                )
            );
        }

        public static async Task<
            Results<Ok<ProjectColumnDetails>, NotFound<ApiMessageResponse>>
        > MoveColumn(
            int projectId,
            int columnId,
            MoveProjectColumnRequest request,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var column = await dbContext
                .ProjectColumns.Where(c => c.Id == columnId && c.ProjectId == projectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (column is null)
                return TypedResults.NotFound(new ApiMessageResponse("Column not found"));

            column.Score = request.Score;
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Ok(
                new ProjectColumnDetails(
                    column.Id,
                    column.Name,
                    column.Score,
                    column.Color,
                    column.CreatedAt,
                    column.UpdatedAt,
                    []
                )
            );
        }

        public static async Task<Results<NoContent, NotFound<ApiMessageResponse>>> DeleteColumn(
            int projectId,
            int columnId,
            ApplicationDbContext dbContext,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            var column = await dbContext
                .ProjectColumns.Where(c => c.Id == columnId && c.ProjectId == projectId)
                .Include(c => c.Tasks)
                    .ThenInclude(t => t.Attachments)
                .FirstOrDefaultAsync(cancellationToken);

            if (column is null)
                return TypedResults.NotFound(new ApiMessageResponse("Column not found"));

            foreach (var task in column.Tasks)
            foreach (var attachment in task.Attachments)
                await fileService.DeleteFileAsync(attachment.Id, cancellationToken);

            dbContext.ProjectColumns.Remove(column);
            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.NoContent();
        }
    }
}
