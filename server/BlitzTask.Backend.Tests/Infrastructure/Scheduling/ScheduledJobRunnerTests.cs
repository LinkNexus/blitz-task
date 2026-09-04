using BlitzTask.Backend.Infrastructure.Scheduling;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace BlitzTask.Backend.Tests.Infrastructure.Scheduling;

/// <summary>
/// Covers the runner's scheduling and failure isolation. Every test drives
/// <see cref="ScheduledJobRunner.RunDueJobsAsync"/> with an explicit clock rather than waiting
/// on the real timer — a scheduler tested by sleeping is a slow, flaky scheduler.
/// </summary>
public class ScheduledJobRunnerTests
{
    private sealed class RecordingJob(string name, TimeSpan interval, bool throws = false)
        : IScheduledJob
    {
        public string Name { get; } = name;
        public TimeSpan Interval { get; } = interval;
        public int Runs { get; private set; }

        public Task RunAsync(CancellationToken cancellationToken)
        {
            Runs++;
            return throws ? Task.FromException(new InvalidOperationException("boom")) : Task.CompletedTask;
        }
    }

    /// <summary>Scoped, so each DI scope gets a distinct <see cref="Id"/>.</summary>
    private sealed class ScopeMarker
    {
        public Guid Id { get; } = Guid.NewGuid();
    }

    /// <summary>Singleton, so it survives across scopes and can record what each one saw.</summary>
    private sealed class ScopeLog
    {
        public List<Guid> Seen { get; } = [];
    }

    private sealed class ScopeCapturingJob(ScopeMarker marker, ScopeLog log) : IScheduledJob
    {
        public string Name => "scope-capture";

        // Zero, so it is due on every tick.
        public TimeSpan Interval => TimeSpan.Zero;

        public Task RunAsync(CancellationToken cancellationToken)
        {
            log.Seen.Add(marker.Id);
            return Task.CompletedTask;
        }
    }

    private static ScheduledJobRunner RunnerFor(params IScheduledJob[] jobs)
    {
        var services = new ServiceCollection();
        foreach (var job in jobs)
            services.AddScoped<IScheduledJob>(_ => job);

        var provider = services.BuildServiceProvider();
        return new ScheduledJobRunner(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<ScheduledJobRunner>.Instance
        );
    }

    private static readonly DateTimeOffset T0 = new(2026, 9, 4, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task RunsAJobOnTheFirstTick()
    {
        // The process restarts on every deploy, so waiting out an interval before the first run
        // would mean a job with a 6-hour interval effectively never runs on a busy deploy day.
        var job = new RecordingJob("a", TimeSpan.FromHours(6));
        await RunnerFor(job).RunDueJobsAsync(T0, CancellationToken.None);

        Assert.Equal(1, job.Runs);
    }

    [Fact]
    public async Task DoesNotRunAgainBeforeItsIntervalElapses()
    {
        var job = new RecordingJob("a", TimeSpan.FromHours(6));
        var runner = RunnerFor(job);

        await runner.RunDueJobsAsync(T0, CancellationToken.None);
        await runner.RunDueJobsAsync(T0.AddMinutes(1), CancellationToken.None);
        await runner.RunDueJobsAsync(T0.AddHours(5), CancellationToken.None);

        Assert.Equal(1, job.Runs);
    }

    [Fact]
    public async Task RunsAgainOnceTheIntervalHasElapsed()
    {
        var job = new RecordingJob("a", TimeSpan.FromHours(6));
        var runner = RunnerFor(job);

        await runner.RunDueJobsAsync(T0, CancellationToken.None);
        await runner.RunDueJobsAsync(T0.AddHours(6), CancellationToken.None);

        Assert.Equal(2, job.Runs);
    }

    [Fact]
    public async Task AFailingJobDoesNotStopTheOthers()
    {
        // The isolation that keeps one broken job from silently disabling every other one.
        var broken = new RecordingJob("broken", TimeSpan.FromHours(1), throws: true);
        var healthy = new RecordingJob("healthy", TimeSpan.FromHours(1));

        await RunnerFor(broken, healthy).RunDueJobsAsync(T0, CancellationToken.None);

        Assert.Equal(1, broken.Runs);
        Assert.Equal(1, healthy.Runs);
    }

    [Fact]
    public async Task AFailingJobStillWaitsItsInterval()
    {
        // Scheduled before running, so a job that throws backs off instead of retrying — and
        // filling the log — on every single tick.
        var broken = new RecordingJob("broken", TimeSpan.FromHours(6), throws: true);
        var runner = RunnerFor(broken);

        await runner.RunDueJobsAsync(T0, CancellationToken.None);
        await runner.RunDueJobsAsync(T0.AddMinutes(1), CancellationToken.None);

        Assert.Equal(1, broken.Runs);
    }

    [Fact]
    public async Task JobsOnDifferentIntervalsAreScheduledIndependently()
    {
        var fast = new RecordingJob("fast", TimeSpan.FromMinutes(5));
        var slow = new RecordingJob("slow", TimeSpan.FromHours(6));
        var runner = RunnerFor(fast, slow);

        await runner.RunDueJobsAsync(T0, CancellationToken.None);
        await runner.RunDueJobsAsync(T0.AddMinutes(10), CancellationToken.None);

        Assert.Equal(2, fast.Runs);
        Assert.Equal(1, slow.Runs);
    }

    [Fact]
    public async Task BuildsAFreshScopePerTick()
    {
        // The bug this guards: the runner is a singleton and jobs depend on the scoped
        // ApplicationDbContext. Reusing one scope would hand every tick the same context, which
        // accumulates tracked entities for the life of the container and serves stale reads.
        var services = new ServiceCollection();
        services.AddScoped<ScopeMarker>();
        services.AddSingleton<ScopeLog>();
        services.AddScoped<IScheduledJob, ScopeCapturingJob>();
        var provider = services.BuildServiceProvider();

        var runner = new ScheduledJobRunner(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<ScheduledJobRunner>.Instance
        );

        await runner.RunDueJobsAsync(T0, CancellationToken.None);
        await runner.RunDueJobsAsync(T0.AddMinutes(1), CancellationToken.None);

        var seen = provider.GetRequiredService<ScopeLog>().Seen;
        Assert.Equal(2, seen.Count);
        Assert.NotEqual(seen[0], seen[1]);
    }
}
