using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectMembers;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Features.Shared.Services;
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
                .AddEndpointFilter(ValidationFilter<ProjectRequest>.Body())
                .Produces<ProjectDetails>(StatusCodes.Status201Created)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapGet("/{projectId:int}", GetProject)
                .WithName("get-project")
                .AddEndpointFilter(new RequireProjectPermissionFilter())
                .Produces<ProjectDetails>()
                .Produces(StatusCodes.Status404NotFound);

            group
                .MapPut("/{projectId:int}", UpdateProject)
                .WithName("update-project")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.EditProject)
                )
                .AddEndpointFilter(ValidationFilter<ProjectRequest>.Body())
                .Produces<ProjectDetails>()
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapDelete("/{projectId:int}", DeleteProject)
                .WithName("delete-project")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.DeleteProject)
                )
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            group
                .MapGet("/{projectId:int}/attachments/{attachmentId:guid}", AccessAttachment)
                .WithName("access-project-attachment")
                .AddEndpointFilter(new RequireProjectPermissionFilter())
                .Produces<FileStreamHttpResult>(StatusCodes.Status200OK)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ApiMessageResponse>(StatusCodes.Status403Forbidden);

            return app;
        }

        private static ProjectColumn[] CreateDefaultColumns()
        {
            var colNames = new string[] { "Backlog", "In Progress", "Review", "Done" };
            var colorNames = new string[] { "#FF0000", "#00FF00", "#0000FF", "#FFFF00" };
            var columns = new ProjectColumn[colNames.Length];

            for (int i = 0; i < colNames.Length; ++i)
            {
                columns[i] = new ProjectColumn
                {
                    Name = colNames[i],
                    Score = i * 1000,
                    Color = colorNames[i],
                };
            }

            return columns;
        }

        public static async Task<IResult> CreateProject(
            [FromForm] ProjectRequest request,
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
                    ProjectRequest.MaxImageSizeInBytes,
                    cancellationToken
                );

                if (uploadRes.Success && uploadRes.Attachment is not null)
                {
                    imageId = uploadRes.Attachment.Id;
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
                Invitations = [],
                Columns = CreateDefaultColumns(),
            };

            await dbContext.Projects.AddAsync(project, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Json(
                project.ToProjectDetails().WithPermissionsFor(user.Id),
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
            var details = await dbContext
                .Projects.Where(p => p.Id == projectId)
                .SelectProjectDetails()
                .FirstOrDefaultAsync(cancellationToken);

            if (details is null)
                return Results.NotFound(new ApiMessageResponse("Project not found."));

            return Results.Json(details.WithPermissionsFor(user.Id));
        }

        public static async Task<IResult> UpdateProject(
            int projectId,
            [FromForm] ProjectRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            var project = await dbContext.Projects.FindAsync([projectId], cancellationToken);
            if (project is null)
                return Results.NotFound(new ApiMessageResponse("Project not found."));

            var user = context.GetUser();
            var imageId = project.ImageId;

            project.Name = request.Name;
            project.Description = request.Description;
            project.StartDate = request.StartDate;
            project.DueDate = request.DueDate;
            project.Tags = request.Tags ?? [];

            if (request.Image is not null)
            {
                if (project.ImageId.HasValue)
                    await fileService.DeleteFileAsync(project.ImageId.Value, cancellationToken);

                var uploadRes = await fileService.UploadFileAsync(
                    request.Image,
                    "images",
                    user.Id,
                    ProjectRequest.MaxImageSizeInBytes,
                    cancellationToken
                );

                if (uploadRes.Success && uploadRes.Attachment is not null)
                    imageId = uploadRes.Attachment.Id;
            }

            project.ImageId = imageId;
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Json(project.ToProjectDetails().WithPermissionsFor(user.Id));
        }

        public static async Task<Results<NoContent, NotFound<ApiMessageResponse>>> DeleteProject(
            int projectId,
            ApplicationDbContext dbContext,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            var project = await dbContext
                .Projects.Where(p => p.Id == projectId)
                .Include(p => p.Tasks)
                    .ThenInclude(t => t.Attachments)
                .FirstOrDefaultAsync(cancellationToken);

            if (project is null)
                return TypedResults.NotFound(new ApiMessageResponse("Project not found"));

            if (project.ImageId.HasValue)
                await fileService.DeleteFileAsync(project.ImageId.Value, cancellationToken);

            foreach (var task in project.Tasks.ToList())
            foreach (var attachment in task.Attachments.ToList())
                await fileService.DeleteFileAsync(attachment.Id, cancellationToken);

            dbContext.Projects.Remove(project);
            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.NoContent();
        }

        public static async Task<
            Results<NotFound<ApiMessageResponse>, FileStreamHttpResult>
        > AccessAttachment(
            int projectId,
            Guid attachmentId,
            ApplicationDbContext dbContext,
            HttpContext context,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            var projectData = await dbContext
                .Projects.Where(p => p.Id == projectId)
                .Select(p => new
                {
                    p.ImageId,
                    AttachmentIds = p.Tasks
                        .SelectMany(t => t.Attachments)
                        .Select(a => a.Id)
                        .ToList(),
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (
                projectData is null
                || (
                    projectData.ImageId != attachmentId
                    && !projectData.AttachmentIds.Contains(attachmentId)
                )
            )
            {
                return TypedResults.NotFound(new ApiMessageResponse("Attachment not found"));
            }

            var fileRes = await fileService.GetFileAsync(attachmentId, cancellationToken);

            if (fileRes is null)
            {
                return TypedResults.NotFound(new ApiMessageResponse("Attachment not found"));
            }

            return TypedResults.File(
                fileRes.FileStream,
                contentType: fileRes.ContentType,
                fileDownloadName: fileRes.FileName
            );
        }
    }
}
