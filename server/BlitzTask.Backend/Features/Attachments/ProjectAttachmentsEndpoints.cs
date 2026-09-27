using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Attachments
{
    /// <summary>
    /// Files that belong to the project, and the references a task makes to them.
    /// <para>
    /// The distinction that matters everywhere below: <b>uploading</b> creates an
    /// <see cref="Attachment"/>, and everything else only adds or drops a <i>reference</i> to
    /// one. Nothing here deletes a file — see <see cref="AttachmentOrphanSweepJob"/>.
    /// </para>
    /// </summary>
    public static class ProjectAttachmentsEndpoints
    {
        public static IEndpointRouteBuilder MapProjectAttachmentsEndpoints(
            this IEndpointRouteBuilder app
        )
        {
            var group = app.MapGroup("/api/projects/{projectId:int}/attachments")
                .WithTags("Attachments")
                .RequireAuthorization("EmailConfirmed");

            group
                .MapGet("", ListProjectAttachments)
                // Membership only. Seeing which files exist is reading the project, and a Viewer
                // can already open every one of them through the download endpoint.
                .AddEndpointFilter(new RequireProjectPermissionFilter())
                .WithName("list-project-attachments")
                .Produces<List<ProjectAttachmentDetails>>();

            group
                .MapPost("", UploadProjectAttachment)
                .DisableAntiforgery()
                // ManageTasks rather than EditProject: a Contributor already uploads files onto
                // tasks, so a file the project holds is no new power — and gating it higher would
                // mean the person doing the work cannot share the spec they are working from.
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageTasks)
                )
                .WithName("upload-project-attachment")
                .Produces<ProjectAttachmentDetails>(StatusCodes.Status201Created)
                .Produces<ApiMessageResponse>(StatusCodes.Status400BadRequest);

            group
                .MapDelete("/{attachmentId:guid}", RemoveProjectAttachment)
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageTasks)
                )
                .WithName("remove-project-attachment")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            var taskGroup = app.MapGroup(
                    "/api/{projectId:int}/tasks/{taskId:int}/attachments/{attachmentId:guid}"
                )
                .WithTags("Attachments")
                .RequireAuthorization("EmailConfirmed")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageTasks)
                );

            taskGroup
                .MapPost("", ReferenceAttachmentFromTask)
                .WithName("reference-task-attachment")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            taskGroup
                .MapDelete("", DereferenceAttachmentFromTask)
                .WithName("dereference-task-attachment")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            return app;
        }

        /// <summary>
        /// The project's files, each with how many of its tasks point at it.
        /// <para>
        /// The count is the whole point of the screen: it is what tells someone that removing a
        /// file from the project is not going to strand three tasks, and it is counted over
        /// <b>this project's</b> tasks because that is the question being asked — a file a task
        /// in another project references is not this project's business.
        /// </para>
        /// </summary>
        public static async Task<Ok<List<ProjectAttachmentDetails>>> ListProjectAttachments(
            int projectId,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var attachmentIds = dbContext
                .Set<ProjectAttachment>()
                .Where(j => j.ProjectId == projectId)
                .Select(j => j.AttachmentId);

            // Ordered before the projection, never after: sorting a constructed record is
            // untranslatable and throws at request time rather than falling back.
            var files = await dbContext
                .Attachments.Where(a => attachmentIds.Contains(a.Id))
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new ProjectAttachmentDetails(
                    a.Id,
                    a.OriginalFilename,
                    a.ContentType,
                    a.SizeInBytes,
                    a.CreatedAt,
                    dbContext
                        .Set<ProjectTaskAttachment>()
                        .Count(j =>
                            j.AttachmentId == a.Id
                            && dbContext.ProjectTasks.Any(t =>
                                t.Id == j.ProjectTaskId && t.RelatedProjectId == projectId
                            )
                        )
                ))
                .ToListAsync(cancellationToken);

            return TypedResults.Ok(files);
        }

        public static async Task<
            Results<Created<ProjectAttachmentDetails>, BadRequest<ApiMessageResponse>>
        > UploadProjectAttachment(
            int projectId,
            [FromForm] IFormFile file,
            ApplicationDbContext dbContext,
            HttpContext context,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            var uploadResult = await fileService.UploadFileAsync(
                file,
                "attachments",
                context.GetUser().Id,
                null,
                cancellationToken
            );

            if (!uploadResult.Success || uploadResult.Attachment is null)
            {
                return TypedResults.BadRequest(
                    new ApiMessageResponse(uploadResult.ErrorMessage ?? "Upload failed")
                );
            }

            var attachment = uploadResult.Attachment;

            dbContext
                .Set<ProjectAttachment>()
                .Add(new ProjectAttachment { ProjectId = projectId, AttachmentId = attachment.Id });

            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Created(
                $"/api/projects/{projectId}/attachments/{attachment.Id}",
                new ProjectAttachmentDetails(
                    attachment.Id,
                    attachment.OriginalFilename,
                    attachment.ContentType,
                    attachment.SizeInBytes,
                    attachment.CreatedAt,
                    ReferencedByTaskCount: 0
                )
            );
        }

        /// <summary>
        /// Takes the file off the project.
        /// <para>
        /// <b>Tasks referencing it keep it.</b> They hold their own rows, and dropping the
        /// project's says nothing about theirs — which is the property that makes this button
        /// safe to press, and the reason it is not gated any higher than uploading.
        /// </para>
        /// </summary>
        public static async Task<Results<NoContent, NotFound<ApiMessageResponse>>> RemoveProjectAttachment(
            int projectId,
            Guid attachmentId,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var removed = await dbContext
                .Set<ProjectAttachment>()
                .Where(j => j.ProjectId == projectId && j.AttachmentId == attachmentId)
                .ExecuteDeleteAsync(cancellationToken);

            if (removed == 0)
                return TypedResults.NotFound(new ApiMessageResponse("Attachment not found"));

            return TypedResults.NoContent();
        }

        /// <summary>
        /// Points a task at a file the project already holds.
        /// <para>
        /// A reference deliberately does <b>not</b> count against
        /// <see cref="ProjectTask.MaxAttachmentsCount"/>: that cap bounds how much someone can
        /// upload, and referencing uploads nothing. Counting it would make the shared-file feature
        /// compete with the per-task one for the same five slots.
        /// </para>
        /// <para>
        /// The file must already be the project's. Without that check this endpoint would take
        /// any attachment id in the system and attach it — and since the download endpoint
        /// authorises by "is this file reachable from the project", attaching a stranger's file
        /// would be enough to read it.
        /// </para>
        /// </summary>
        public static async Task<Results<NoContent, NotFound<ApiMessageResponse>>> ReferenceAttachmentFromTask(
            int projectId,
            int taskId,
            Guid attachmentId,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var belongsToProject = await dbContext
                .Set<ProjectAttachment>()
                .AnyAsync(
                    j => j.ProjectId == projectId && j.AttachmentId == attachmentId,
                    cancellationToken
                );

            var task = await dbContext
                .ProjectTasks.Include(t => t.Attachments)
                .FirstOrDefaultAsync(
                    t => t.Id == taskId && t.RelatedProjectId == projectId,
                    cancellationToken
                );

            if (!belongsToProject || task is null)
                return TypedResults.NotFound(new ApiMessageResponse("Attachment not found"));

            if (task.Attachments.Any(a => a.Id == attachmentId))
                return TypedResults.NoContent();

            var attachment = await dbContext.Attachments.FirstAsync(
                a => a.Id == attachmentId,
                cancellationToken
            );

            task.Attachments.Add(attachment);
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.NoContent();
        }

        /// <summary>Drops the task's reference. The project keeps the file.</summary>
        public static async Task<Results<NoContent, NotFound<ApiMessageResponse>>> DereferenceAttachmentFromTask(
            int projectId,
            int taskId,
            Guid attachmentId,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var task = await dbContext
                .ProjectTasks.Include(t => t.Attachments)
                .FirstOrDefaultAsync(
                    t => t.Id == taskId && t.RelatedProjectId == projectId,
                    cancellationToken
                );

            var attachment = task?.Attachments.FirstOrDefault(a => a.Id == attachmentId);

            if (task is null || attachment is null)
                return TypedResults.NotFound(new ApiMessageResponse("Attachment not found"));

            task.Attachments.Remove(attachment);
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.NoContent();
        }
    }
}
