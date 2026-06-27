using FluentValidation;

namespace BlitzTask.Backend.Features.ProjectColumns
{
    public class ProjectColumnsValidator : AbstractValidator<CreateProjectColumnRequest>
    {
        public ProjectColumnsValidator()
        {
            RuleFor(x => x.Name)
                .NotEmpty()
                .WithMessage("Name is required.")
                .MaximumLength(100)
                .WithMessage("Name must not exceed 100 characters.");

            RuleFor(x => x.Score).NotEmpty().WithMessage("Score is required.");
        }
    }
}
