using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.ProjectSections
{
    public static class ProjectSectionsEndpoints
    {
        public static IEndpointRouteBuilder MapProjectSectionsEndpoints(
            this IEndpointRouteBuilder app
        )
        {
            // ManageColumns rather than a permission of its own. Shaping a project into sections
            // and shaping it into columns are the same act by the same people, and a second
            // permission that every role holds exactly when it holds the first is a distinction
            // with nothing behind it. Split it the day the roles genuinely differ.
            var group = app.MapGroup("/api/{projectId:int}/sections")
                .WithTags("Project Sections")
                .RequireAuthorization("EmailConfirmed")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageColumns)
                );

            group
                .MapPost("", CreateSection)
                .WithName("create-project-section")
                .AddEndpointFilter(ValidationFilter<CreateProjectSectionRequest>.Body())
                .Produces<ProjectSectionDetails>(StatusCodes.Status201Created)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapPatch("/{sectionId:int}", UpdateSection)
                .WithName("update-project-section")
                .AddEndpointFilter(ValidationFilter<UpdateProjectSectionRequest>.Body())
                .Produces<ProjectSectionDetails>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapDelete("/{sectionId:int}", DeleteSection)
                .WithName("delete-project-section")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            return app;
        }

        public static async Task<JsonHttpResult<ProjectSectionDetails>> CreateSection(
            int projectId,
            CreateProjectSectionRequest request,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var section = new ProjectSection
            {
                ProjectId = projectId,
                Name = request.Name.Trim(),
                Color = request.Color,
                Score = request.Score,
            };

            dbContext.ProjectSections.Add(section);
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Json(
                new ProjectSectionDetails(section.Id, section.Name, section.Color, section.Score),
                statusCode: StatusCodes.Status201Created
            );
        }

        public static async Task<
            Results<Ok<ProjectSectionDetails>, NotFound<ApiMessageResponse>>
        > UpdateSection(
            int projectId,
            int sectionId,
            UpdateProjectSectionRequest request,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var section = await dbContext.ProjectSections.FirstOrDefaultAsync(
                s => s.Id == sectionId && s.ProjectId == projectId,
                cancellationToken
            );

            if (section is null)
                return TypedResults.NotFound(new ApiMessageResponse("Section not found"));

            section.Name = request.Name.Trim();
            section.Color = request.Color;
            section.Score = request.Score;
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Ok(
                new ProjectSectionDetails(section.Id, section.Name, section.Color, section.Score)
            );
        }

        public static async Task<Results<NoContent, NotFound<ApiMessageResponse>>> DeleteSection(
            int projectId,
            int sectionId,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var section = await dbContext.ProjectSections.FirstOrDefaultAsync(
                s => s.Id == sectionId && s.ProjectId == projectId,
                cancellationToken
            );

            if (section is null)
                return TypedResults.NotFound(new ApiMessageResponse("Section not found"));

            // The tasks stay. Deleting a section says "stop splitting the board this way", never
            // "throw this work away". Done explicitly rather than left to the FK's SetNull so it
            // is true of rows already tracked in this context too.
            await dbContext
                .ProjectTasks.Where(t => t.SectionId == sectionId)
                .ExecuteUpdateAsync(t => t.SetProperty(x => x.SectionId, (int?)null), cancellationToken);

            dbContext.ProjectSections.Remove(section);
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.NoContent();
        }
    }
}
