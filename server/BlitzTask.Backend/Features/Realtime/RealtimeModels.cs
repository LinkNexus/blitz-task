namespace BlitzTask.Backend.Features.Realtime
{
    /// <summary>
    /// What the server sends when a project's contents changed.
    /// <para>
    /// <b>A signal, not a patch.</b> It says <i>that</i> something changed, not what — the client
    /// invalidates and refetches. Sending the change itself is the tempting version and it means
    /// reimplementing, for remote events, the optimistic cache surgery the board already does for
    /// local ones; CLAUDE.md's warning about rebuilding columns from a drag order is a description
    /// of how that goes wrong. A refetch costs one request and cannot corrupt the cache.
    /// </para>
    /// </summary>
    /// <param name="ProjectId">Which board to refresh.</param>
    /// <param name="ActorId">
    /// Who caused it, so a client can ignore the echo of its own action — it applied that
    /// optimistically already, and refetching over the top of an in-flight drag is exactly the
    /// jump this feature is supposed to prevent.
    /// </param>
    public record ProjectChangedEvent(int ProjectId, int? ActorId);

    public static class RealtimeMessages
    {
        public const string ProjectChanged = "projectChanged";
        public const string NotificationsChanged = "notificationsChanged";
    }
}
