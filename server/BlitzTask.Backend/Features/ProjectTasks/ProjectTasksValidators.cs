using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Infrastructure.Extensions;
using FluentValidation;
using Microsoft.Extensions.Options;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public class UpdateProjectTaskRequestValidator : AbstractValidator<UpdateProjectTaskRequest>
    {
        public UpdateProjectTaskRequestValidator(IOptions<FileUploadSettings> fileUploadSettings)
        {
            RuleFor(x => x.Name)
                .NotEmpty()
                .WithMessage("Task name is required")
                .MaximumLength(100)
                .WithMessage("Task name must be at most 100 characters long");

            RuleFor(x => x.Description)
                .MaximumLength(1000)
                .WithMessage("Description must be at most 1000 characters long");

            RuleFor(x => x.Tags)
                .Must(tags => tags is null || tags.Count <= ProjectTask.MaxTagsCount)
                .WithMessage($"Maximum {ProjectTask.MaxTagsCount} tags allowed")
                .ForEach(tag => tag.MaximumLength(ProjectTask.MaxTagsLength));

            RuleFor(x => x.Priority).IsInEnum().WithMessage("Priority must be a valid enum value");

            RuleFor(x => x.StartDate)
                .Must(
                    (request, startDate) =>
                        startDate is null || request.DueDate is null || startDate <= request.DueDate
                )
                .WithMessage("Start date cannot be after due date");

            RuleFor(x => x.DueDate)
                .Must(
                    (request, dueDate) =>
                        dueDate is null || request.StartDate is null || dueDate >= request.StartDate
                )
                .WithMessage("Due date cannot be before start date");

            When(
                x => x.NewAttachments is not null,
                () =>
                {
                    RuleFor(x => x.NewAttachments!)
                        .Must(attachments => attachments.Count <= ProjectTask.MaxAttachmentsCount)
                        .WithMessage($"Maximum {ProjectTask.MaxAttachmentsCount} attachments allowed")
                        .ForEach(a =>
                        {
                            a.Must(x =>
                                    fileUploadSettings.Value.AllowedFileTypes.ContainsKey(
                                        x.ContentType
                                    )
                                )
                                .WithMessage("Attachment must be a valid image or document file type")
                                .Must(x => x.Length <= fileUploadSettings.Value.MaxFileSizeInBytes)
                                .WithMessage(
                                    $"Attachment must be at most {fileUploadSettings.Value.MaxFileSizeInBytes} bytes"
                                );
                        });
                }
            );
        }
    }

    public class CreateProjectTaskRequestValidator : AbstractValidator<CreateProjectTaskRequest>
    {
        public CreateProjectTaskRequestValidator(
            IOptions<FileUploadSettings> fileUploadSettings,
            IHttpContextAccessor httpContextAccessor
        )
        {
            var context = httpContextAccessor.HttpContext;

            RuleFor(x => x.Name)
                .NotEmpty()
                .WithMessage("Task name is required")
                .MaximumLength(100)
                .WithMessage("Task name must be at most 255 characters long");

            RuleFor(x => x.Description)
                .MaximumLength(1000)
                .WithMessage("Description must be at most 1000 characters long");

            RuleFor(x => x.Tags)
                .Must(tags => tags is null || tags.Count <= ProjectTask.MaxTagsCount)
                .WithMessage($"Maximum {ProjectTask.MaxTagsCount} tags allowed")
                .ForEach(tag => tag.MaximumLength(ProjectTask.MaxTagsLength));

            RuleFor(x => x.Priority).IsInEnum().WithMessage("Priority must be a valid enum value");

            RuleFor(x => x.StartDate)
                .Must(
                    (request, startDate) =>
                        startDate is null || request.DueDate is null || startDate <= request.DueDate
                )
                .WithMessage("Start date cannot be after due date");

            RuleFor(x => x.DueDate)
                .Must(
                    (request, dueDate) =>
                        dueDate is null || request.StartDate is null || dueDate >= request.StartDate
                )
                .WithMessage("Due date cannot be before start date");

            When(
                x => x.Attachments is not null,
                () =>
                {
                    RuleFor(x => x.Attachments!)
                        .Must(attachments => attachments.Count <= ProjectTask.MaxAttachmentsCount)
                        .WithMessage(
                            $"Maximum {ProjectTask.MaxAttachmentsCount} attachments allowed"
                        )
                        .ForEach(a =>
                        {
                            a.Must(x =>
                                    fileUploadSettings.Value.AllowedFileTypes.ContainsKey(
                                        x.ContentType
                                    )
                                )
                                .WithMessage(
                                    "Attachment must be a valid image or document file type"
                                )
                                .Must(x => x.Length <= fileUploadSettings.Value.MaxFileSizeInBytes)
                                .WithMessage(
                                    $"Attachment must be at most {fileUploadSettings.Value.MaxFileSizeInBytes} bytes"
                                );
                        });
                }
            );
        }
    }
}
