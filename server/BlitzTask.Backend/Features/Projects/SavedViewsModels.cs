using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.Projects
{
    /// <summary>
    /// A named way of looking at a board — "my urgent work", "everything due this week" — kept
    /// per user, per project.
    /// <para>
    /// <b>Private to its author, like a reminder and unlike a comment.</b> A view is how someone
    /// chooses to read the work, not a fact about the work, so it is scoped to the caller in
    /// every query here. Sharing one is done by sending the URL, which carries the whole
    /// definition; there is deliberately no project-wide view that everyone sees, because that
    /// would need its own rule about who may edit it.
    /// </para>
    /// <para>
    /// Note what is <i>not</i> here: <see cref="Infrastructure.Data.RealtimePublishInterceptor"/>
    /// switches on the entity types a project's watchers care about, and this is not one of them.
    /// Saving a private view must not make everyone else's board refetch.
    /// </para>
    /// </summary>
    public class SavedView : IAuditable
    {
        public const int MaxNameLength = 60;

        /// <summary>
        /// Generous, because the string holds an assignee id per filtered member and a free-text
        /// search. It is a bound against a client writing junk, not a considered budget.
        /// </summary>
        public const int MaxSearchLength = 2000;

        public int Id { get; set; }
        public int ProjectId { get; set; }
        public int UserId { get; set; }
        public required string Name { get; set; }

        /// <summary>
        /// The view's definition: the board's search params as JSON, e.g.
        /// <c>{"view":"table","priority":["URGENT"],"group":"assignee"}</c>.
        /// <para>
        /// <b>Opaque to the server on purpose.</b> Every filter in it is frontend vocabulary: a
        /// due bucket of "this week" is computed in <c>due-dates.ts</c> against the viewer's
        /// clock, and means something different from anything <c>GET /api/tasks</c> offers.
        /// Typed columns here would be a second, drifting copy of that vocabulary and would make
        /// each new filter a migration — while buying nothing, since no query on this side ever
        /// reads inside the value.
        /// </para>
        /// <para>
        /// What keeps that safe is on the other side: the route's zod schema already has to
        /// survive arbitrary junk arriving in a link, so a stored view is validated by exactly
        /// the same schema as a pasted URL, and anything an older or newer client cannot read
        /// falls back to a default rather than breaking the page. See <c>view-search.ts</c> for
        /// why the stored form is JSON rather than the URL's own query string.
        /// </para>
        /// </summary>
        public required string Search { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public Project Project { get; set; } = null!;
        public User User { get; set; } = null!;
    }

    public record CreateSavedViewRequest(string Name, string Search);

    /// <summary>
    /// Both fields, every time — renaming a view and overwriting its filters are separate
    /// actions in the UI, but a view is private to one person, so the "someone else changed it
    /// underneath you" race that would argue for patching one field at a time cannot happen.
    /// </summary>
    public record UpdateSavedViewRequest(string Name, string Search);

    public record SavedViewDetails(int Id, string Name, string Search);
}
