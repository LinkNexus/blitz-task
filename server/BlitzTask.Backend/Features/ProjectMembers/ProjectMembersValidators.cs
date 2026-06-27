using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Infrastructure.Extensions;
using FluentValidation;

namespace BlitzTask.Backend.Features.ProjectMembers
{
    public class AddParticipantRequestValidator : AbstractValidator<AddParticipantRequest>
    {
        public AddParticipantRequestValidator(IHttpContextAccessor httpContextAccessor)
        {
            var currentUser = httpContextAccessor.HttpContext!.GetUser();
            var project = httpContextAccessor.HttpContext!.GetItem<Project>("Project");

            var currentParticipant = project.Participants.FirstOrDefault(p =>
                p.UserId == currentUser.Id
            );

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
                        .Must(role =>
                            ProjectPermissions.HasPermission(
                                currentParticipant!.Role,
                                ProjectPermission.ManageCollaborators
                            )
                        )
                        .WithMessage("You do not have permission to assign the Collaborator role");
                }
            );

            RuleFor(x => x.Email)
                .Must(email => !project.Participants.Any(p => p.User.Email == email))
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
            var currentUser = httpContextAccessor.HttpContext!.GetUser();
            var project = httpContextAccessor.HttpContext!.GetItem<Project>("Project");

            var currentParticipant = project.Participants.FirstOrDefault(p =>
                p.UserId == currentUser.Id
            );

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
                        .Must(role =>
                            ProjectPermissions.HasPermission(
                                currentParticipant!.Role,
                                ProjectPermission.ManageCollaborators
                            )
                        )
                        .WithMessage("You do not have permission to assign the Collaborator role");
                }
            );
        }
    }
}
