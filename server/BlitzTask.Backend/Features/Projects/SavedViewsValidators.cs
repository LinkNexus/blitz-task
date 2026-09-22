using FluentValidation;

namespace BlitzTask.Backend.Features.Projects
{
    public static class SavedViewRules
    {
        /// <summary>
        /// What a view's name has to be. An extension on the rule builder rather than a child
        /// validator so the error still reports against <c>name</c> and the SPA can show it under
        /// the input.
        /// <para>
        /// Whitespace-only is empty: the handler trims, so a name of four spaces would store
        /// blank and render as an unclickable gap in the menu.
        /// </para>
        /// </summary>
        public static IRuleBuilderOptions<T, string> SavedViewName<T>(
            this IRuleBuilder<T, string> rule
        ) =>
            rule.NotEmpty()
                .WithMessage("A view needs a name")
                .Must(name => !string.IsNullOrWhiteSpace(name))
                .WithMessage("A view needs a name")
                .MaximumLength(SavedView.MaxNameLength)
                .WithMessage($"A name cannot be longer than {SavedView.MaxNameLength} characters");

        /// <summary>
        /// The filters themselves are not validated field by field — the server does not read
        /// inside the string (see <see cref="SavedView.Search"/>), and the route's schema coerces
        /// anything it cannot parse back to a default. All that is enforced here is a bound, so a
        /// client cannot use the column as storage.
        /// </summary>
        public static IRuleBuilderOptions<T, string> SavedViewSearch<T>(
            this IRuleBuilder<T, string> rule
        ) =>
            rule.MaximumLength(SavedView.MaxSearchLength)
                .WithMessage("These filters are too long to save");
    }

    public class CreateSavedViewRequestValidator : AbstractValidator<CreateSavedViewRequest>
    {
        public CreateSavedViewRequestValidator()
        {
            RuleFor(x => x.Name).SavedViewName();
            RuleFor(x => x.Search).SavedViewSearch();
        }
    }

    public class UpdateSavedViewRequestValidator : AbstractValidator<UpdateSavedViewRequest>
    {
        public UpdateSavedViewRequestValidator()
        {
            RuleFor(x => x.Name).SavedViewName();
            RuleFor(x => x.Search).SavedViewSearch();
        }
    }
}
