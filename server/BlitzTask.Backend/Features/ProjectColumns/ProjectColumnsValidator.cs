using FluentValidation;

namespace BlitzTask.Backend.Features.ProjectColumns
{
    public class UpdateProjectColumnRequestValidator : AbstractValidator<UpdateProjectColumnRequest>
    {
        public UpdateProjectColumnRequestValidator()
        {
            RuleFor(x => x.Name)
                .NotEmpty()
                .WithMessage("Name is required.")
                .MaximumLength(100)
                .WithMessage("Name must not exceed 100 characters.");

            RuleFor(x => x.Color)
                .NotEmpty()
                .WithMessage("Color is required.")
                .Matches("^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$")
                .WithMessage("Color must be a valid css hex color code.");
        }
    }

    public class ProjectColumnsValidator : AbstractValidator<CreateProjectColumnRequest>
    {
        public ProjectColumnsValidator()
        {
            RuleFor(x => x.Name)
                .NotEmpty()
                .WithMessage("Name is required.")
                .MaximumLength(100)
                .WithMessage("Name must not exceed 100 characters.");

            RuleFor(x => x.Color)
                .NotEmpty()
                .WithMessage("Color is required.")
                .Matches("^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$")
                .WithMessage("Color must be a valid css hex color code.");

            RuleFor(x => x.Score)
                .NotEmpty()
                .WithMessage("Score is required.")
                .Must(x => !float.IsNaN(x) && !float.IsInfinity(x))
                .WithMessage("Score must be a valid finite number.");
        }
    }
}
