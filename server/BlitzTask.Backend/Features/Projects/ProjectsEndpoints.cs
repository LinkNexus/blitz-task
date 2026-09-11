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
                .MapGet("", ListProjects)
                .WithName("list-projects")
                .Produces<List<ProjectSummary>>();

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
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ApiMessageResponse>(StatusCodes.Status400BadRequest);

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

        public static async Task<Ok<List<ProjectSummary>>> ListProjects(
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            // Most recently touched first: in a task app the project you were just working in
            // is almost always the one you want next.
            //
            // Ordered *before* the projection, not after. Sorting an already-projected
            // ProjectSummary asks EF to ORDER BY a member of a constructed record, which it
            // cannot translate — and it throws at request time rather than falling back, so the
            // endpoint 500s on every call.
            // The Inbox is a project only so that tasks, columns, scores and RBAC keep working;
            // it is not one the user filed anything into, so it stays out of the sidebar, the
            // dashboard panel and the project count. /api/inbox is the only way to it.
            var projects = await dbContext
                .Projects.Where(p => !p.IsInbox)
                .OrderByDescending(p => p.UpdatedAt)
                .SelectProjectSummariesFor(user.Id)
                .ToListAsync(cancellationToken);

            return TypedResults.Ok(projects);
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

        public static async Task<
            Results<NoContent, NotFound<ApiMessageResponse>, BadRequest<ApiMessageResponse>>
        > DeleteProject(
            int projectId,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var project = await dbContext
                .Projects.Where(p => p.Id == projectId)
                .Include(p => p.Tasks)
                .Include(p => p.Columns)
                .FirstOrDefaultAsync(cancellationToken);

            if (project is null)
                return TypedResults.NotFound(new ApiMessageResponse("Project not found"));

            // Nothing recreates an Inbox with its captures in it — GetInbox would hand back a
            // fresh empty one and the tasks would be left orphaned behind a flag nothing reads.
            if (project.IsInbox)
                return TypedResults.BadRequest(
                    new ApiMessageResponse("Your Inbox cannot be deleted.")
                );

            // Trashed, not destroyed. Nothing on disk is touched here: the image and every
            // attachment have to survive until the purge, or restoring gives back a project whose
            // files 404.
            //
            // One instant is stamped across the project and everything under it, and that shared
            // value is load-bearing — it is how the restore tells apart what came down with the
            // project from what was already in the trash on its own.
            //
            // Hence the explicit DeletedAt == null: the query filter keeps trashed rows out of the
            // SQL, but EF's navigation fix-up puts any that happen to be *tracked* back into these
            // collections, and re-stamping one would quietly resurrect it on the next restore.
            var deletedAt = DateTime.UtcNow;
            project.DeletedAt = deletedAt;

            foreach (var column in project.Columns.Where(c => c.DeletedAt == null))
                column.DeletedAt = deletedAt;

            foreach (var task in project.Tasks.Where(t => t.DeletedAt == null))
                task.DeletedAt = deletedAt;

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
