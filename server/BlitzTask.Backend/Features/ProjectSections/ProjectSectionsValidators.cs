using FluentValidation;

namespace BlitzTask.Backend.Features.ProjectSections
{
    public static class ProjectSectionRules
    {
        public static IRuleBuilderOptions<T, string> SectionName<T>(
            this IRuleBuilder<T, string> rule
        ) =>
            rule.NotEmpty()
                .WithMessage("A section needs a name")
                .Must(name => !string.IsNullOrWhiteSpace(name))
                .WithMessage("A section needs a name")
                .MaximumLength(ProjectSection.MaxNameLength)
                .WithMessage(
                    $"A name cannot be longer than {ProjectSection.MaxNameLength} characters"
                );

        public static IRuleBuilderOptions<T, string> SectionColor<T>(
            this IRuleBuilder<T, string> rule
        ) => rule.NotEmpty().WithMessage("A section needs a colour").MaximumLength(9);
    }

    public class CreateProjectSectionRequestValidator
        : AbstractValidator<CreateProjectSectionRequest>
    {
        public CreateProjectSectionRequestValidator()
        {
            RuleFor(x => x.Name).SectionName();
            RuleFor(x => x.Color).SectionColor();
        }
    }

    public class UpdateProjectSectionRequestValidator
        : AbstractValidator<UpdateProjectSectionRequest>
    {
        public UpdateProjectSectionRequestValidator()
        {
            RuleFor(x => x.Name).SectionName();
            RuleFor(x => x.Color).SectionColor();
        }
    }
}
