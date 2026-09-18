using FluentValidation;

namespace BlitzTask.Backend.Features.TaskComments
{
    public static class TaskCommentRules
    {
        /// <summary>
        /// What a comment body has to be, in one place because create and update ask for exactly
        /// the same thing. An extension on the rule builder rather than a child validator, so the
        /// error still reports against <c>body</c> and the SPA can show it under the box.
        /// <para>
        /// Whitespace-only is empty. The handler trims, so a comment of four spaces would store
        /// blank and render as a nameless gap in the thread — and unlike L26's checklist rows, a
        /// blank comment is not an abandoned line inside a larger save that should still go
        /// through. It is the whole request.
        /// </para>
        /// </summary>
        public static IRuleBuilderOptions<T, string> CommentBody<T>(
            this IRuleBuilder<T, string> rule
        ) =>
            rule.NotEmpty()
                .WithMessage("A comment cannot be empty")
                .Must(body => !string.IsNullOrWhiteSpace(body))
                .WithMessage("A comment cannot be empty")
                .MaximumLength(TaskComment.MaxBodyLength)
                .WithMessage(
                    $"A comment cannot be longer than {TaskComment.MaxBodyLength} characters"
                );
    }

    public class CreateTaskCommentRequestValidator : AbstractValidator<CreateTaskCommentRequest>
    {
        public CreateTaskCommentRequestValidator()
        {
            RuleFor(x => x.Body).CommentBody();
        }
    }

    public class UpdateTaskCommentRequestValidator : AbstractValidator<UpdateTaskCommentRequest>
    {
        public UpdateTaskCommentRequestValidator()
        {
            RuleFor(x => x.Body).CommentBody();
        }
    }
}
