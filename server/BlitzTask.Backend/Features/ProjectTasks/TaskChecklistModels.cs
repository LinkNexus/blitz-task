namespace BlitzTask.Backend.Features.ProjectTasks
{
    /// <summary>
    /// One step of a task's checklist — the light half of "break this down". A checklist rather
    /// than a self-referencing parent on <see cref="ProjectTask"/>: nesting would put recursion
    /// into every membership query, every board and every drag, and the thing it buys back is a
    /// sub-task that can be assigned, scheduled and moved, which is not what "tick these five
    /// steps off" is asking for.
    /// <para>
    /// Shared, not personal — unlike <see cref="TaskReminder"/>, this describes the work itself,
    /// so everyone who can see the task sees the same list in the same state.
    /// </para>
    /// </summary>
    public class TaskChecklistItem
    {
        public int Id { get; set; }
        public int ProjectTaskId { get; set; }
        public required string Text { get; set; }

        /// <summary>
        /// Ticked or not. Deliberately absent from <see cref="ChecklistItemInput"/>: the task's
        /// own PUT never carries it, so a save cannot overwrite a tick made while the sheet was
        /// open. <c>PATCH .../checklist/{itemId}</c> is the only thing that writes it.
        /// </summary>
        public bool IsDone { get; set; }

        /// <summary>
        /// Rank within the task, assigned from the submitted order. A plain int rather than the
        /// float <c>Score</c> the board and columns use, because a checklist arrives as a whole
        /// ordered list rather than as one item dropped between two others — there are no
        /// neighbours to interpolate between, so there is nothing for a float to buy.
        /// </summary>
        public int Position { get; set; }

        public ProjectTask ProjectTask { get; set; } = null!;
    }

    /// <summary>
    /// A checklist item as submitted on a task's create/update request. <c>Id</c> is null for an
    /// item being added and set for one that already exists — which is what lets the handler
    /// reconcile rather than rebuild, and so keep the item's ticked state across a save.
    /// </summary>
    public record ChecklistItemInput
    {
        public int? Id { get; set; }
        public string Text { get; set; } = null!;
    }

    public record SetChecklistItemDoneRequest(bool IsDone);

    public record ChecklistItemDetails(int Id, string Text, bool IsDone, int Position);
}
