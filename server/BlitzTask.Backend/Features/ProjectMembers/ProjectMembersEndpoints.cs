using System.Net;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Features.Shared.Services;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.ProjectMembers
{
    public static class ProjectMembersEndpoints
    {
        public static IEndpointRouteBuilder MapProjectMembersEndpoints(
            this IEndpointRouteBuilder app
        )
        {
            var group = app.MapGroup("/api/project-members")
                .WithTags("Project Members")
                .RequireAuthorization()
                .RequireAuthorization("EmailConfirmed");

            group
                .MapPost("/{projectId:int}", AddProjectMember)
                .WithName("add-project-member")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageParticipants)
                )
                .AddEndpointFilter(ValidationFilter<AddParticipantRequest>.Body());

            group
                .MapDelete(
                    "/{projectId:int}/invitations/{invitationId:int}",
                    RevokeProjectInvitation
                )
                .WithName("revoke-project-invitation")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageParticipants)
                )
                .Produces<ApiMessageResponse>(StatusCodes.Status403Forbidden);

            group
                .MapGet("/invitations/{invitationToken:guid}", GetProjectInvitation)
                .WithName("get-project-invitation");

            group
                .MapPost("/invitations/respond/{invitationToken:guid}", RespondToInvitation)
                .WithName("respond-invitation");

            group
                .MapPut("/{projectId:int}/change-role/{participantId:int}", ChangeProjectMemberRole)
                .WithName("change-project-member-role")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageParticipants)
                )
                .AddEndpointFilter(ValidationFilter<UpdateParticipantRoleRequest>.Body());

            group
                .MapDelete("/{projectId:int}/remove-member/{participantId:int}", RemoveMember)
                .WithName("remove-project-member")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageParticipants)
                )
                .Produces<ApiMessageResponse>(StatusCodes.Status403Forbidden);

            group
                .MapDelete("/{projectId:int}/leave", LeaveProject)
                .WithName("leave-project")
                .AddEndpointFilter(new RequireProjectPermissionFilter())
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status400BadRequest);

            return app;
        }

        public static async Task<
            Results<
                Ok<ProjectInvitation>,
                BadRequest<ApiMessageResponse>,
                InternalServerError<ApiMessageResponse>
            >
        > AddProjectMember(
            int projectId,
            AddParticipantRequest request,
            ApplicationDbContext dbContext,
            MailerService mailerService,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var projectName =
                await dbContext
                    .Projects.Where(p => p.Id == projectId)
                    .Select(p => p.Name)
                    .FirstOrDefaultAsync(cancellationToken)
                ?? string.Empty;
            var invitation = await dbContext
                .ProjectInvitations.Where(pi =>
                    pi.ProjectId == projectId && pi.GuestEmail == request.Email
                )
                .FirstOrDefaultAsync(cancellationToken);

            if (invitation is not null)
            {
                if (DateTime.UtcNow - invitation.CreatedAt < ProjectInvitation.ExpirationTime)
                {
                    return TypedResults.BadRequest(
                        new ApiMessageResponse(
                            "A valid invitation has already been sent to this email for the specified project"
                        )
                    );
                }

                invitation.CreatedAt = DateTime.UtcNow;
                invitation.Role = request.Role;
            }
            else
            {
                invitation = new()
                {
                    GuestEmail = request.Email,
                    Role = request.Role,
                    ProjectId = projectId,
                };

                await dbContext.ProjectInvitations.AddAsync(invitation, cancellationToken);
            }

            try
            {
                var encodedToken = WebUtility.UrlEncode(invitation.Token.ToString());
                var respondUrl =
                    $"{context.Request.Scheme}://{context.Request.Host}/projects/respond-invitation/{encodedToken}";

                await mailerService.SendEmailAsync(
                    new(
                        [request.Email],
                        $"Invitation to join {projectName} on BlitzTask",
                        TemplateName: "ProjectInvitation",
                        TemplateModel: new ProjectInvitationModel
                        {
                            InviterName = context.GetUser().Name,
                            ProjectName = projectName,
                            Role = request.Role.ToString(),
                            InvitationLink = respondUrl,
                        }
                    )
                );
            }
            catch (Exception)
            {
                return TypedResults.InternalServerError(
                    new ApiMessageResponse(
                        "Failed to send invitation email. Retry later or contact the site maintainer"
                    )
                );
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.Ok(invitation);
        }

        public static async Task<
            Results<NoContent, JsonHttpResult<ApiMessageResponse>, NotFound<ApiMessageResponse>>
        > RevokeProjectInvitation(
            int projectId,
            int invitationId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var currentParticipant = context.GetProjectParticipant();
            var invitation = await dbContext
                .ProjectInvitations.Where(pi => pi.Id == invitationId && pi.ProjectId == projectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (invitation is null)
            {
                return TypedResults.NotFound(new ApiMessageResponse("Invitation not found"));
            }

            if (
                invitation.Role == ProjectRole.Collaborator
                && !ProjectPermissions.HasPermission(
                    currentParticipant.Role,
                    ProjectPermission.ManageCollaborators
                )
            )
            {
                return TypedResults.Json(
                    new ApiMessageResponse("You do not have permission to revoke this invitation"),
                    statusCode: 403
                );
            }

            dbContext.ProjectInvitations.Remove(invitation);
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.NoContent();
        }

        public static async Task<
            Results<
                Ok<ProjectInvitationDetails>,
                NotFound<ApiMessageResponse>,
                BadRequest<ApiMessageResponse>
            >
        > GetProjectInvitation(
            Guid invitationToken,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var invitation = await dbContext
                .ProjectInvitations.Where(pi => pi.Token == invitationToken)
                .Select(pi => new ProjectInvitationDetails(
                    pi.Id,
                    pi.GuestEmail,
                    pi.Role,
                    pi.ProjectId,
                    pi.Project.Name,
                    pi.Token,
                    pi.CreatedAt
                ))
                .AsNoTracking()
                .FirstOrDefaultAsync(cancellationToken);

            if (invitation is null)
            {
                return TypedResults.NotFound(new ApiMessageResponse("Invitation not found"));
            }

            if (DateTime.UtcNow - invitation.CreatedAt > ProjectInvitation.ExpirationTime)
            {
                return TypedResults.BadRequest(new ApiMessageResponse("Invitation has expired"));
            }

            return TypedResults.Ok(invitation);
        }

        public static async Task<
            Results<Ok<bool>, BadRequest<ApiMessageResponse>, NotFound<ApiMessageResponse>>
        > RespondToInvitation(
            Guid invitationToken,
            [FromQuery] bool accepted,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();
            var invitation = await dbContext
                .ProjectInvitations.Where(pi => pi.Token == invitationToken)
                .FirstOrDefaultAsync(cancellationToken);

            if (invitation is null)
            {
                return TypedResults.NotFound(
                    new ApiMessageResponse("Project Invitation not found")
                );
            }

            if (user.Email != invitation.GuestEmail)
            {
                return TypedResults.BadRequest(
                    new ApiMessageResponse(
                        "Your email address does not correspond to that present in the invitation"
                    )
                );
            }

            if (DateTime.UtcNow - invitation.CreatedAt > ProjectInvitation.ExpirationTime)
            {
                return TypedResults.BadRequest(
                    new ApiMessageResponse("Project Invitation has expired")
                );
            }

            if (accepted)
            {
                var projectParticipant = new ProjectParticipant
                {
                    ProjectId = invitation.ProjectId,
                    UserId = user.Id,
                    Role = invitation.Role,
                };

                await dbContext.ProjectParticipants.AddAsync(projectParticipant, cancellationToken);
            }

            dbContext.ProjectInvitations.Remove(invitation);
            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.Ok(accepted);
        }

        public static async Task<
            Results<
                Ok<ProjectParticipantInfo>,
                NotFound<ApiMessageResponse>,
                BadRequest<ApiMessageResponse>
            >
        > ChangeProjectMemberRole(
            int projectId,
            int participantId,
            UpdateParticipantRoleRequest request,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var projectParticipant = await dbContext
                .ProjectParticipants.Where(pp => pp.Id == participantId && pp.ProjectId == projectId)
                .Include(pp => pp.User)
                .FirstOrDefaultAsync(cancellationToken);

            if (projectParticipant is null)
            {
                return TypedResults.NotFound(
                    new ApiMessageResponse("Project Participant was not found")
                );
            }

            projectParticipant.Role = request.Role;
            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.Ok(
                new ProjectParticipantInfo(
                    participantId,
                    projectParticipant.UserId,
                    projectParticipant.User.Name,
                    projectParticipant.Role,
                    projectParticipant.CreatedAt
                )
            );
        }

        public static async Task<
            Results<
                NoContent,
                BadRequest<ApiMessageResponse>,
                JsonHttpResult<ApiMessageResponse>,
                NotFound<ApiMessageResponse>
            >
        > RemoveMember(
            int projectId,
            int participantId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var projectParticipant = await dbContext
                .ProjectParticipants.Where(pp => pp.Id == participantId && pp.ProjectId == projectId)
                .FirstOrDefaultAsync(cancellationToken);

            var currentParticipant = await dbContext
                .ProjectParticipants.Where(pp =>
                    pp.ProjectId == projectId && pp.UserId == context.GetUser().Id
                )
                .FirstOrDefaultAsync(cancellationToken);

            if (projectParticipant is null)
            {
                return TypedResults.NotFound(
                    new ApiMessageResponse("Project Participant was not found")
                );
            }

            if (projectParticipant.Role == ProjectRole.Owner)
            {
                return TypedResults.BadRequest(
                    new ApiMessageResponse("Cannot remove the owner of the project")
                );
            }

            if (
                projectParticipant.Role == ProjectRole.Collaborator
                && !ProjectPermissions.HasPermission(
                    currentParticipant!.Role,
                    ProjectPermission.ManageCollaborators
                )
            )
            {
                return TypedResults.Json(
                    new ApiMessageResponse(
                        "You do not have permission to remove this collaborator"
                    ),
                    statusCode: StatusCodes.Status403Forbidden
                );
            }

            dbContext.ProjectParticipants.Remove(projectParticipant);
            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.NoContent();
        }

        public static async Task<
            Results<NoContent, BadRequest<ApiMessageResponse>>
        > LeaveProject(
            int projectId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var userId = context.GetUser().Id;
            var participant = await dbContext
                .ProjectParticipants.Where(pp =>
                    pp.ProjectId == projectId && pp.UserId == userId
                )
                .FirstOrDefaultAsync(cancellationToken);

            if (participant is null || participant.Role == ProjectRole.Owner)
                return TypedResults.BadRequest(
                    new ApiMessageResponse("The owner cannot leave the project")
                );

            dbContext.ProjectParticipants.Remove(participant);
            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.NoContent();
        }
    }
}
