using Microsoft.Extensions.DependencyInjection;

namespace BlitzTask.Backend.Infrastructure.Scheduling
{
    /// <summary>
    /// Runs every registered <see cref="IScheduledJob"/> on its own interval.
    /// <para>
    /// A plain <see cref="BackgroundService"/> on a timer is the right size here: the app deploys
    /// as a single container, so there is no second instance to coordinate with, and a job
    /// library would add a dependency and a second storage model for nothing.
    /// </para>
    /// </summary>
    public class ScheduledJobRunner(
        IServiceScopeFactory scopeFactory,
        ILogger<ScheduledJobRunner> logger
    ) : BackgroundService
    {
        /// <summary>
        /// How often the runner wakes to look for due jobs. This is the scheduling granularity,
        /// not a job's interval — a job asking for 6 hours gets it to within one tick.
        /// </summary>
        public static readonly TimeSpan TickInterval = TimeSpan.FromMinutes(1);

        private readonly Dictionary<string, DateTimeOffset> _nextRunByJob = [];

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Tick once immediately rather than waiting out the first interval. The process
            // restarts on every deploy, and anything that came due while it was down is waiting.
            await RunDueJobsAsync(DateTimeOffset.UtcNow, stoppingToken);

            using var timer = new PeriodicTimer(TickInterval);
            try
            {
                while (await timer.WaitForNextTickAsync(stoppingToken))
                {
                    await RunDueJobsAsync(DateTimeOffset.UtcNow, stoppingToken);
                }
            }
            catch (OperationCanceledException)
            {
                // Shutdown, not a failure.
            }
        }

        /// <summary>
        /// One tick. Takes <paramref name="now"/> rather than reading the clock so tests can
        /// drive scheduling deterministically instead of sleeping.
        /// </summary>
        public async Task RunDueJobsAsync(DateTimeOffset now, CancellationToken cancellationToken)
        {
            // A scope per tick, not per process: jobs depend on the scoped ApplicationDbContext,
            // and this runner is a singleton. Resolving them from the root provider would either
            // throw or hand every tick the same context, which would accumulate tracked entities
            // for the lifetime of the container.
            using var scope = scopeFactory.CreateScope();
            var jobs = scope.ServiceProvider.GetServices<IScheduledJob>();

            foreach (var job in jobs)
            {
                if (_nextRunByJob.TryGetValue(job.Name, out var nextRun) && now < nextRun)
                    continue;

                // Scheduled before running, so a job that throws still waits its full interval
                // instead of retrying every tick.
                _nextRunByJob[job.Name] = now + job.Interval;

                try
                {
                    await job.RunAsync(cancellationToken);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception exception)
                {
                    // Isolated deliberately: one broken job must not take down the loop and with
                    // it every other job, silently, until someone notices a restart fixed things.
                    logger.LogError(exception, "Scheduled job {JobName} failed", job.Name);
                }
            }
        }
    }
}
