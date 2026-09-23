using FluentValidation;

namespace BlitzTask.Backend.Features.Export
{
    public class ExportEnvelopeValidator : AbstractValidator<ExportEnvelope>
    {
        /// <summary>Bounds on one request, so a file cannot be a denial of service.</summary>
        public const int MaxProjects = 100;
        public const int MaxTasks = 5000;

        public ExportEnvelopeValidator()
        {
            // The whole reason the exporter writes a version. Refusing outright beats reading a
            // shape that has since changed meaning and half-applying it — an import creates rows,
            // and there is no undo beyond deleting what it made.
            RuleFor(x => x.FormatVersion)
                .Equal(ExportEnvelope.CurrentVersion)
                .WithMessage(
                    $"This file is version {{PropertyValue}}; this app reads version {ExportEnvelope.CurrentVersion}."
                );

            RuleFor(x => x.Projects)
                .NotEmpty()
                .WithMessage("There is nothing in this file to import")
                .Must(p => p.Count <= MaxProjects)
                .WithMessage($"A single import cannot carry more than {MaxProjects} projects")
                .Must(p =>
                    p.Sum(project => project.Columns.Sum(c => c.Tasks.Count)) <= MaxTasks
                )
                .WithMessage($"A single import cannot carry more than {MaxTasks} tasks");

            RuleForEach(x => x.Projects)
                .ChildRules(project =>
                    project
                        .RuleFor(p => p.Name)
                        .NotEmpty()
                        .WithMessage("Every project in the file needs a name")
                );
        }
    }
}
