using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.ProjectMembers
{
    public class AddParticipantRequestValidator : AbstractValidator<AddParticipantRequest>
    {
        public AddParticipantRequestValidator(
            IHttpContextAccessor httpContextAccessor,
            ApplicationDbContext dbContext
        )
        {
            var httpContext = httpContextAccessor.HttpContext!;
            var currentUser = httpContext.GetUser();
            var currentParticipant = httpContext.GetProjectParticipant();
            var projectId = currentParticipant.ProjectId;

            RuleFor(x => x.Email)
                .NotEmpty()
                .WithMessage("Email is required")
                .EmailAddress()
                .WithMessage("Invalid email address");

            RuleFor(x => x.Role)
                .IsInEnum()
                .WithMessage("Invalid role")
                .Must(role => role != ProjectRole.Owner)
                .WithMessage("Cannot assign the Owner role");

            When(
                x => x.Role == ProjectRole.Collaborator,
                () =>
                {
                    RuleFor(x => x.Role)
                        .Must(_ =>
                            ProjectPermissions.HasPermission(
                                currentParticipant.Role,
                                ProjectPermission.ManageCollaborators
                            )
                        )
                        .WithMessage("You do not have permission to assign the Collaborator role");
                }
            );

            RuleFor(x => x.Email)
                .MustAsync(async (email, ct) =>
                    !await dbContext.ProjectParticipants
                        .Where(pp => pp.ProjectId == projectId && pp.User.Email == email)
                        .AnyAsync(ct)
                )
                .WithMessage("User is already a participant in this project");

            RuleFor(x => x.Email)
                .Must(email => email != currentUser.Email)
                .WithMessage("Cannot add yourself as a participant");
        }
    }

    public class UpdateParticipantRoleRequestValidator
        : AbstractValidator<UpdateParticipantRoleRequest>
    {
        public UpdateParticipantRoleRequestValidator(IHttpContextAccessor httpContextAccessor)
        {
            var currentParticipant = httpContextAccessor.HttpContext!.GetProjectParticipant();

            RuleFor(x => x.Role)
                .IsInEnum()
                .WithMessage("Invalid role")
                .Must(r => r != ProjectRole.Owner)
                .WithMessage("Cannot assign the Owner role");

            When(
                x => x.Role == ProjectRole.Collaborator,
                () =>
                {
                    RuleFor(x => x.Role)
                        .Must(_ =>
                            ProjectPermissions.HasPermission(
                                currentParticipant.Role,
                                ProjectPermission.ManageCollaborators
                            )
                        )
                        .WithMessage("You do not have permission to assign the Collaborator role");
                }
            );
        }
    }
}
