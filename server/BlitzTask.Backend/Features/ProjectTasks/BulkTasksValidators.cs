using FluentValidation;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public static class BulkTaskRules
    {
        /// <summary>
        /// A selection has to name something, and cannot be unbounded. The cap is a bound on one
        /// request rather than a product limit — the whole batch is loaded and tracked in memory,
        /// so it is the number that decides how large that gets.
        /// </summary>
        public const int MaxTaskIds = 200;

        public static IRuleBuilderOptions<T, List<int>> BulkTaskIds<T>(
            this IRuleBuilder<T, List<int>> rule
        ) =>
            rule.NotEmpty()
                .WithMessage("Select at least one task")
                .Must(ids => ids.Count <= MaxTaskIds)
                .WithMessage($"Cannot change more than {MaxTaskIds} tasks at once");
    }

    public class BulkMoveTasksRequestValidator : AbstractValidator<BulkMoveTasksRequest>
    {
        public BulkMoveTasksRequestValidator()
        {
            RuleFor(x => x.TaskIds).BulkTaskIds();
        }
    }

    public class BulkDeleteTasksRequestValidator : AbstractValidator<BulkDeleteTasksRequest>
    {
        public BulkDeleteTasksRequestValidator()
        {
            RuleFor(x => x.TaskIds).BulkTaskIds();
        }
    }

    public class BulkAssignTasksRequestValidator : AbstractValidator<BulkAssignTasksRequest>
    {
        public BulkAssignTasksRequestValidator()
        {
            RuleFor(x => x.TaskIds).BulkTaskIds();

            // Only Replace is meaningful with an empty list — that is how "clear the assignees
            // on all of these" is expressed. Adding or removing nobody is a no-op the caller
            // almost certainly did not mean.
            RuleFor(x => x.AssigneeIds)
                .NotEmpty()
                .When(x => x.Mode != BulkEditMode.Replace)
                .WithMessage("Choose at least one person");
        }
    }

    public class BulkTagTasksRequestValidator : AbstractValidator<BulkTagTasksRequest>
    {
        public BulkTagTasksRequestValidator()
        {
            RuleFor(x => x.TaskIds).BulkTaskIds();

            RuleFor(x => x.Tags)
                .NotEmpty()
                .When(x => x.Mode != BulkEditMode.Replace)
                .WithMessage("Enter at least one tag");

            // Replace writes this list onto every task verbatim, so it is the one mode that can
            // break the per-task cap on its own. Add is checked in the handler instead, where
            // what each task already carries is known.
            RuleFor(x => x.Tags)
                .Must(tags => tags.Count <= ProjectTask.MaxTagsCount)
                .When(x => x.Mode == BulkEditMode.Replace)
                .WithMessage($"Maximum {ProjectTask.MaxTagsCount} tags allowed")
                .ForEach(tag => tag.MaximumLength(ProjectTask.MaxTagsLength));
        }
    }
}
