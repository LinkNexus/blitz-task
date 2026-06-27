using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;

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
                .AddEndpointFilter(ValidationFilter<CreateProjectColumnRequest>.Body());

            return app;
        }

        public static async Task<Ok<ProjectColumn>> CreateColumn(
            int projectId,
            CreateProjectColumnRequest request,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var column = new ProjectColumn
            {
                ProjectId = projectId,
                Name = request.Name,
                Score = request.Score,
            };

            await dbContext.ProjectColumns.AddAsync(column, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.Ok(column);
        }
    }
}
