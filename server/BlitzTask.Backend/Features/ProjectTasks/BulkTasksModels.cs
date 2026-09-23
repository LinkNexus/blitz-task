using System.Text.Json.Serialization;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    /// <summary>
    /// How a bulk edit treats the values it is given.
    /// <para>
    /// <c>Replace</c> is separate from <c>Add</c> on purpose: "tag all of these <i>release</i>"
    /// and "make <i>release</i> the only tag on all of these" are different intentions, and a
    /// single-task edit expresses the second by sending the whole list (see
    /// <c>UpdateTask</c>). A bulk edit cannot — the tasks start out with different lists — so
    /// the mode has to say which one is meant.
    /// </para>
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter<BulkEditMode>))]
    public enum BulkEditMode
    {
        Add,
        Remove,
        Replace,
    }

    public record BulkMoveTasksRequest(List<int> TaskIds, int ColumnId);

    public record BulkAssignTasksRequest(
        List<int> TaskIds,
        List<int> AssigneeIds,
        BulkEditMode Mode
    );

    public record BulkTagTasksRequest(List<int> TaskIds, List<string> Tags, BulkEditMode Mode);

    public record BulkDeleteTasksRequest(List<int> TaskIds);

    /// <summary>
    /// What a bulk edit actually did.
    /// <para>
    /// A count rather than <c>204</c>, because the selection and the outcome can legitimately
    /// differ and the caller has no other way to find out. Ids that name a task in another
    /// project — or one already in the trash — are simply not matched, so a stale selection
    /// degrades to doing less rather than failing the whole batch.
    /// </para>
    /// <para>
    /// <see cref="Skipped"/> is the interesting half: it counts tasks that matched and were
    /// deliberately left alone. Today the only source is <see cref="ProjectTask.MaxTagsCount"/>
    /// — adding a tag to a task already at the cap is refused rather than allowed to break the
    /// limit, and rather than silently dropping one of the tags it already has.
    /// </para>
    /// </summary>
    public record BulkTaskResult(int Affected, int Skipped);
}
