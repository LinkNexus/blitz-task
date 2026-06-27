using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public static class ProjectTasksEndpoints
    {
        public static IEndpointRouteBuilder MapProjectTasksEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/{projectId:int}/tasks")
                .WithTags("Project Tasks")
                .RequireAuthorization("EmailConfirmed");

            group
                .MapPost("/{columnId:int}/create", CreateTask)
                .WithName("create-project-task")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageTasks)
                )
                .AddEndpointFilter(ValidationFilter<CreateProjectTaskRequest>.Body())
                .Produces<ProjectTaskDetails>(StatusCodes.Status201Created);

            return app;
        }

        public static async Task<
            Results<JsonHttpResult<ProjectTaskDetails>, NotFound<ApiMessageResponse>>
        > CreateTask(
            int projectId,
            int columnId,
            CreateProjectTaskRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();
            var project = context.GetItem<Project>("Project");
            var column = await dbContext
                .ProjectColumns.Where(c => c.Id == columnId)
                .FirstOrDefaultAsync(cancellationToken);

            if (column is null)
            {
                return TypedResults.NotFound(
                    new ApiMessageResponse("Project column was not found")
                );
            }

            List<Attachment> attachments = [];
            if (request.Attachments is not null)
            {
                foreach (var attachment in request.Attachments)
                {
                    var uploadRes = await fileService.UploadFileAsync(
                        attachment,
                        "attachments",
                        user.Id,
                        null,
                        cancellationToken
                    );

                    if (uploadRes.Success && uploadRes.Attachment is not null)
                    {
                        attachments.Add(uploadRes.Attachment);
                        project.Attachments.Add(uploadRes.Attachment);
                    }
                }
            }

            List<User> assignees = [];
            if (request.AssigneeIds is not null)
            {
                assignees = await dbContext
                    .Users.Where(u => request.AssigneeIds.Contains(u.Id))
                    .ToListAsync(cancellationToken);
            }

            var task = new ProjectTask
            {
                Name = request.Name,
                Description = request.Description,
                RelatedColumnId = columnId,
                RelatedProjectId = projectId,
                Score = request.Score,
                StartDate = request.StartDate,
                DueDate = request.DueDate,
                Attachments = attachments,
                Assignees = assignees,
                Priority = request.Priority,
                Tags = request.Tags ?? [],
            };

            dbContext.ProjectTasks.Add(task);
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Json(
                task.ToProjectTasksDetails(),
                statusCode: StatusCodes.Status201Created
            );
        }
    }
}
