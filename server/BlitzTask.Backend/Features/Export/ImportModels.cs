namespace BlitzTask.Backend.Features.Export
{
    /// <summary>
    /// What an import actually did. Every number after the first two is something the file asked
    /// for and this instance could not give it, which is the part a caller cannot work out on
    /// their own — so it is reported rather than swallowed.
    /// </summary>
    /// <param name="TasksIntoInbox">
    /// Captures from the file's Inbox, which land in the caller's existing Inbox rather than in a
    /// project of their own. See <see cref="Projects.InboxEndpoints.GetOrCreateAsync"/>.
    /// </param>
    /// <param name="MembersSkipped">
    /// People named in the file who have no account here. They are not invited: an import is a
    /// restore, and quietly emailing someone because a file mentioned them is not.
    /// </param>
    /// <param name="CommentsSkipped">
    /// Comments whose author has no account here. Attributing them to the importer would forge
    /// authorship in a thread, and a comment has nowhere else to hang.
    /// </param>
    /// <param name="AttachmentsSkipped">
    /// Files named in the export, whose bytes it never carried. Counted so a restore says plainly
    /// what is missing rather than looking complete.
    /// </param>
    public record ImportResult(
        int ProjectsCreated,
        int TasksImported,
        int TasksIntoInbox,
        int MembersSkipped,
        int CommentsSkipped,
        int AttachmentsSkipped
    );
}
