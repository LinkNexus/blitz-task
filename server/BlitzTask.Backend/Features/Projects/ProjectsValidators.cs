using BlitzTask.Backend.Features.Attachments;
using FluentValidation;
using Microsoft.Extensions.Options;

namespace BlitzTask.Backend.Features.Projects
{
    public class CreateProjectRequestValidator : AbstractValidator<ProjectRequest>
    {
        public CreateProjectRequestValidator(IOptions<FileUploadSettings> fileUploadSettings)
        {
            RuleFor(x => x.Name)
                .NotEmpty()
                .WithMessage("Project name is required")
                .MaximumLength(255)
                .WithMessage("Project name must be at most 255 characters long");

            RuleFor(x => x.Description)
                .MaximumLength(1000)
                .WithMessage("Description must be at most 1000 characters long");

            RuleFor(x => x.StartDate)
                .Must(
                    (request, startDate) =>
                        startDate is null || request.DueDate is null || startDate <= request.DueDate
                )
                .WithMessage("Start date cannot be after due date");

            // An enum binds from its *number* as readily as from its name, so `Accent=99` is a
            // successful bind to `(ProjectAccent)99` — which no token in `index.css` answers to,
            // and which `JsonStringEnumConverter` then hands the client as the string "99".
            // Guarding the range here is what keeps that out of the database.
            RuleFor(x => x.Accent)
                .IsInEnum()
                .WithMessage("Unknown accent");

            RuleFor(x => x.Tags)
                .Must(tags => tags is null || tags.Count <= 10)
                .WithMessage("Maximum 10 tags allowed")
                .ForEach(tag => tag.MaximumLength(50));

            When(
                x => x.Image is not null,
                () =>
                {
                    RuleFor(x => x.Image!)
                        .Must(file => file.Length <= ProjectRequest.MaxImageSizeInBytes)
                        .WithMessage(
                            $"Image must be at most {ProjectRequest.MaxImageSizeInBytes} bytes"
                        );

                    RuleFor(x => x.Image!)
                        .Must(file =>
                            fileUploadSettings.Value.ValidImageContentTypes.Contains(
                                file.ContentType
                            )
                        )
                        .WithMessage("Image must be PNG, JPEG, SVG, or WebP");
                }
            );
        }
    }
}
