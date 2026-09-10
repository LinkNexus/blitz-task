using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Infrastructure.Extensions;
using FluentValidation;
using Microsoft.Extensions.Options;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    /// <summary>
    /// Shape only. An empty item is not an error — the handler drops it, because a row the user
    /// started and abandoned should not fail the save it is sitting in.
    /// </summary>
    public class ChecklistItemInputValidator : AbstractValidator<ChecklistItemInput>
    {
        public ChecklistItemInputValidator()
        {
            RuleFor(x => x.Text)
                .MaximumLength(ProjectTask.MaxChecklistItemLength)
                .WithMessage(
                    $"A checklist item must be at most {ProjectTask.MaxChecklistItemLength} characters long"
                );
        }
    }

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

            // Only shape is checked here — count and sign. The "no due date" case is not an
            // error: the handler ignores reminder offsets while the task has no deadline, so
            // that clearing one keeps the reminders instead of dropping them.
            RuleFor(x => x.ReminderMinutesBeforeDue)
                .Must(reminders => reminders is null
                    || reminders.Count <= ProjectTask.MaxRemindersCount)
                .WithMessage($"Maximum {ProjectTask.MaxRemindersCount} reminders allowed")
                .ForEach(reminder =>
                    reminder.GreaterThan(0).WithMessage("A reminder must be set before the due date")
                );

            RuleFor(x => x.ChecklistItems)
                .Must(items => items is null
                    || items.Count <= ProjectTask.MaxChecklistItemsCount)
                .WithMessage($"Maximum {ProjectTask.MaxChecklistItemsCount} checklist items allowed")
                .ForEach(item => item.SetValidator(new ChecklistItemInputValidator()));

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

            // Only shape is checked here — count and sign. The "no due date" case is not an
            // error: the handler ignores reminder offsets while the task has no deadline, so
            // that clearing one keeps the reminders instead of dropping them.
            RuleFor(x => x.ReminderMinutesBeforeDue)
                .Must(reminders => reminders is null
                    || reminders.Count <= ProjectTask.MaxRemindersCount)
                .WithMessage($"Maximum {ProjectTask.MaxRemindersCount} reminders allowed")
                .ForEach(reminder =>
                    reminder.GreaterThan(0).WithMessage("A reminder must be set before the due date")
                );

            RuleFor(x => x.ChecklistItems)
                .Must(items => items is null
                    || items.Count <= ProjectTask.MaxChecklistItemsCount)
                .WithMessage($"Maximum {ProjectTask.MaxChecklistItemsCount} checklist items allowed")
                .ForEach(item => item.SetValidator(new ChecklistItemInputValidator()));

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
