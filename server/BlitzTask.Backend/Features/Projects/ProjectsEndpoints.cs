using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Projects
{
    public static class ProjectsEndpoints
    {
        public static IEndpointRouteBuilder MapProjectsEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/projects")
                .WithTags("Projects")
                .RequireAuthorization("EmailConfirmed");

            group
                .MapPost("/", CreateProject)
                .WithName("create-project")
                .AddEndpointFilter(ValidationFilter<CreateProjectRequest>.Body())
                .Produces<ProjectDetails>(StatusCodes.Status201Created)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapGet("/{projectId:int}", GetProject)
                .WithName("get-project")
                .Produces<ProjectDetails>()
                .Produces(StatusCodes.Status404NotFound);

            group
                .MapGet("/{projectId:int}/attachments/{attachmentId:guid}", AccessAttachment)
                .WithName("access-project-attachment")
                .Produces(StatusCodes.Status404NotFound)
                .Produces<FileStreamHttpResult>(StatusCodes.Status200OK)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ApiMessageResponse>(StatusCodes.Status403Forbidden);

            return app;
        }

        public static async Task<IResult> CreateProject(
            [FromForm] CreateProjectRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();
            Guid? imageId = null;

            if (request.Image is not null)
            {
                var uploadRes = await fileService.UploadFileAsync(
                    request.Image,
                    "images",
                    user.Id,
                    cancellationToken
                );

                if (uploadRes.Success && uploadRes.FileId.HasValue)
                {
                    imageId = uploadRes.FileId.Value;
                }
            }

            var project = new Project
            {
                Name = request.Name,
                Description = request.Description,
                StartDate = request.StartDate,
                DueDate = request.DueDate,
                Tags = request.Tags ?? [],
                ImageId = imageId,
                CreatedBy = user,
                Participants =
                [
                    new ProjectParticipant
                    {
                        User = user,
                        Role = ProjectRole.Owner,
                        CreatedAt = DateTime.UtcNow,
                    },
                ],
            };

            await dbContext.Projects.AddAsync(project, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Json(
                project.ToProjectDetails(),
                statusCode: StatusCodes.Status201Created
            );
        }

        public static async Task<IResult> GetProject(
            int projectId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var project = await dbContext
                .Projects.Where(p =>
                    p.Id == projectId && p.Participants.Any(pp => pp.UserId == user.Id)
                )
                .SelectProjectDetails()
                .AsNoTracking()
                .FirstOrDefaultAsync(cancellationToken);

            if (project is null)
            {
                return Results.NotFound(new ApiMessageResponse("Project not found"));
            }

            return Results.Json(project);
        }

        public static async Task<IResult> AccessAttachment(
            int projectId,
            Guid attachmentId,
            ApplicationDbContext dbContext,
            HttpContext context,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();
            var fileRes = await fileService.GetFileAsync(attachmentId, cancellationToken);

            if (fileRes is null)
            {
                return Results.NotFound(new ApiMessageResponse("Attachment not found"));
            }

            var project = await dbContext
                .Projects.Where(p =>
                    p.Id == projectId
                    && (p.ImageId == attachmentId)
                    && p.Participants.Any(pp => pp.UserId == user.Id)
                )
                .Select(p => new { p.Id })
                .FirstOrDefaultAsync(cancellationToken);

            if (project is null)
            {
                return Results.Json(
                    new ApiMessageResponse("Unauthorized access to attachment"),
                    statusCode: StatusCodes.Status403Forbidden
                );
            }

            return Results.File(
                fileRes.FileStream,
                contentType: fileRes.ContentType,
                fileDownloadName: fileRes.FileName
            );
        }
    }
}
