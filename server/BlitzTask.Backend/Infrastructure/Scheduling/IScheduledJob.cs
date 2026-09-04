namespace BlitzTask.Backend.Infrastructure.Scheduling
{
    /// <summary>
    /// A unit of recurring background work. Implementations are registered <b>scoped</b>, because
    /// they take <c>ApplicationDbContext</c>; <see cref="ScheduledJobRunner"/> builds a fresh
    /// scope per run.
    /// </summary>
    /// <remarks>
    /// Implementations must be <b>idempotent and self-catching-up</b>: the container is replaced
    /// on every deploy, so a job cannot assume it ran on schedule, or at all. Ask the database
    /// what still needs doing rather than tracking progress in memory, and mark work as done
    /// durably so a crash mid-run cannot repeat a side effect such as sending mail twice.
    /// </remarks>
    public interface IScheduledJob
    {
        /// <summary>Stable identifier, used for the runner's scheduling and its logs.</summary>
        string Name { get; }

        /// <summary>How often the job should run. Rounded up to the runner's tick.</summary>
        TimeSpan Interval { get; }

        Task RunAsync(CancellationToken cancellationToken);
    }
}
