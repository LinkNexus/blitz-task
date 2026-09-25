using BlitzTask.Backend.Features.Activity;
using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Realtime;
using BlitzTask.Backend.Features.Search;
using BlitzTask.Backend.Features.Notifications;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectMembers;
using BlitzTask.Backend.Features.ProjectSections;
using BlitzTask.Backend.Features.Push;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Calendar;
using BlitzTask.Backend.Features.Export;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.TaskComments;
using BlitzTask.Backend.Features.Trash;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Features.Shared.Services;
using BlitzTask.Backend.Infrastructure.Auth;
using BlitzTask.Backend.Infrastructure;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Seeding;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Scheduling;
using System.IO.Compression;
using FluentValidation;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Lib.Net.Http.WebPush;
using RazorLight;
using Resend;
using SharpGrip.FluentValidation.AutoValidation.Endpoints.Extensions;

namespace BlitzTask.Backend;

public class Program
{
    private const string SeedFlag = "--seed";

    public static void Main(string[] args)
    {
        // `--seed` is stripped before configuration sees it. The command-line provider parses
        // `--key value` pairs, so a valueless flag does not get rejected — it silently eats the
        // *next* argument as its value, and `--seed --ConnectionStrings:...=x` quietly drops the
        // connection string, leaving the command pointed at whatever the default is. Which, for
        // a seeder, is the one mistake worth engineering out.
        // Answered before a host exists: printing a keypair needs no database, no migrations
        // and no scheduler, and asking for one on a machine with none of those configured
        // should still work.
        if (args.Contains(VapidKeyGenerator.Flag))
        {
            VapidKeyGenerator.Print();
            return;
        }

        var seedRequested = args.Contains(SeedFlag);
        var builder = WebApplication.CreateBuilder(
            [.. args.Where(arg => arg != SeedFlag && arg != VapidKeyGenerator.Flag)]
        );

        builder.Services.AddHttpContextAccessor();

        builder.Services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.ReferenceHandler = System
                .Text
                .Json
                .Serialization
                .ReferenceHandler
                .IgnoreCycles;
        });

        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

        builder.Services.AddSignalR();

        // Scoped, and resolved through the scoped provider: the interceptor carries state
        // between the two halves of one save, so a shared instance would have concurrent
        // requests publishing each other's changes.
        builder.Services.AddScoped<RealtimePublishInterceptor>();
        builder.Services.AddScoped<PushNotificationInterceptor>();
        builder.Services.AddDbContext<ApplicationDbContext>(
            (serviceProvider, options) =>
                options
                    .UseSqlite(connectionString)
                    .AddInterceptors(
                        serviceProvider.GetRequiredService<RealtimePublishInterceptor>(),
                        serviceProvider.GetRequiredService<PushNotificationInterceptor>()
                    )
        );

        // Data Protection keys sign the auth cookie and the antiforgery token. The default
        // store is a container-local path, so a redeploy would silently log every user out and
        // start rejecting their CSRF tokens — keep the keys next to the database, on the same
        // persistent volume. SetApplicationName pins the purpose string across restarts.
        var dataDirectory =
            Path.GetDirectoryName(
                Path.GetFullPath(new SqliteConnectionStringBuilder(connectionString).DataSource)
            ) ?? Path.GetFullPath("Data");
        var keysDirectory = Path.Combine(dataDirectory, "DataProtection-Keys");
        Directory.CreateDirectory(keysDirectory);

        builder
            .Services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(keysDirectory))
            .SetApplicationName("BlitzTask");

        builder.Services.AddValidatorsFromAssemblyContaining<LoginRequestValidator>();
        builder.Services.AddFluentValidationAutoValidation();

        var razorEngine = new RazorLightEngineBuilder()
            .UseFileSystemProject(
                Path.Combine(Directory.GetCurrentDirectory(), "Templates", "Email")
            )
            .UseMemoryCachingProvider()
            .Build();
        builder.Services.AddSingleton(razorEngine);

        if (builder.Environment.IsDevelopment())
        {
            builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("Smtp"));
            builder.Services.AddScoped<MailerService, SmtpMailerService>();
        }
        else
        {
            builder.Services.Configure<ResendSettings>(builder.Configuration.GetSection("Resend"));

            builder
                .Services.AddOptions<ResendClientOptions>()
                .Configure<IConfiguration>(
                    (options, _) =>
                    {
                        options.ApiToken =
                            Environment.GetEnvironmentVariable("RESEND_API_KEY") ?? string.Empty;
                    }
                );
            builder.Services.AddHttpClient<ResendClient>();
            builder.Services.AddScoped<IResend, ResendClient>();
            builder.Services.AddScoped<MailerService, ResendMailerService>();
        }

        builder
            .Services.AddOptions<FileUploadSettings>()
            .BindConfiguration(FileUploadSettings.SectionName)
            .ValidateDataAnnotations()
            .ValidateOnStart();
        builder.Services.AddScoped<IFileService, LocalFileService>();

        builder.Services.Configure<PushSettings>(
            builder.Configuration.GetSection(PushSettings.SectionName)
        );
        // Through the factory, like ResendClient: the push services are ordinary HTTP endpoints
        // and a socket-per-send would exhaust the pool on a busy sweep.
        builder.Services.AddHttpClient<PushServiceClient>();
        builder.Services.AddScoped<PushSender>();

        // The SPA bundle is served uncompressed otherwise — the largest route chunk alone is
        // ~600KB raw against ~180KB gzipped. Static files get no compression from
        // UseStaticFiles on its own.
        builder.Services.AddResponseCompression(options =>
        {
            options.EnableForHttps = true;
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes =
            [
                .. ResponseCompressionDefaults.MimeTypes,
                "application/javascript",
                "text/javascript",
                "image/svg+xml",
                "application/manifest+json",
            ];
        });

        // Measured on the largest route chunk (600KB raw): brotli Optimal 176KB/4ms beats both
        // gzip Optimal (185KB/6ms) and brotli Fastest (200KB/3ms) — smaller *and* faster than
        // gzip, so it is simply the better default. SmallestSize reaches 149KB but costs 560ms
        // per request, which is unaffordable without a compressed-response cache.
        builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
            options.Level = CompressionLevel.Optimal
        );
        builder.Services.Configure<GzipCompressionProviderOptions>(options =>
            options.Level = CompressionLevel.Optimal
        );

        // Jobs are scoped because they depend on ApplicationDbContext; the runner is a
        // singleton and builds a scope per tick.
        builder.Services.Configure<AppSettings>(
            builder.Configuration.GetSection(AppSettings.SectionName)
        );
        builder.Services.AddScoped<AppUrlBuilder>();

        builder.Services.AddScoped<IScheduledJob, ExpiredTokenCleanupJob>();
        builder.Services.AddScoped<IScheduledJob, TaskReminderJob>();
        builder.Services.AddScoped<IScheduledJob, TrashPurgeJob>();

        // Not during document generation: `dotnet build` starts the host to read the API
        // surface, and a runner registered here would tick and send real mail from a build.
        if (!DesignTime.IsDocumentGeneration)
            builder.Services.AddHostedService<ScheduledJobRunner>();

        builder.Services.Configure<ForwardedHeadersOptions>(ForwardedHeadersSetup.Configure);

        builder.Services.AddAntiforgery(options => options.HeaderName = "X-XSRF-TOKEN");

        builder.Services.AddSingleton<
            IAuthorizationMiddlewareResultHandler,
            AuthorizationResultHandler
        >();

        builder
            .Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Events = new CustomCookieAuthenticationEvents();
            });

        builder
            .Services.AddAuthorizationBuilder()
            .AddPolicy(
                "EmailConfirmed",
                policy => policy.Requirements.Add(new EmailConfirmedRequirement())
            );

        builder.Services.AddSingleton<IAuthorizationHandler, EmailConfirmedHandler>();

        builder.Services.AddOpenApi(options =>
        {
            options.AddDocumentTransformer(
                (document, context, cancellationToken) =>
                {
                    document.Servers?.Clear();
                    return Task.CompletedTask;
                }
            );
        });

        var app = builder.Build();

        // A fresh deploy starts against an empty volume, so bring the schema up before
        // serving traffic. The data directory itself is created above, when the key ring is
        // configured — SQLite will not create it for us.
        //
        // Skipped during document generation for the same reason as the scheduler: a build
        // should not migrate the database it happens to be pointed at.
        if (!DesignTime.IsDocumentGeneration)
        using (var scope = app.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            dbContext.Database.Migrate();

            var uploadDirectory = app
                .Services.GetRequiredService<
                    Microsoft.Extensions.Options.IOptions<FileUploadSettings>
                >()
                .Value.UploadDirectory;
            Directory.CreateDirectory(Path.GetFullPath(uploadDirectory));
        }

        // `--seed` is a command, not a mode: it fills an empty development database with a
        // project that looks used, prints how to sign in, and exits without serving anything.
        // Read straight from args rather than through configuration because a bare flag with no
        // value is not something the command-line provider accepts.
        if (seedRequested)
        {
            using var seedScope = app.Services.CreateScope();

            // Blocked rather than awaited: Main stays synchronous, because the entry point is
            // what DesignTime.IsDocumentGeneration inspects and this is not the place to
            // discover that changing its shape moved something.
            Console.WriteLine(
                DevelopmentSeeder
                    .RunAsync(
                        seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),
                        app.Environment
                    )
                    .GetAwaiter()
                    .GetResult()
            );

            return;
        }

        // First in the pipeline, deliberately: it rewrites Scheme, Host and RemoteIpAddress
        // from the proxy's headers, and anything that runs before it sees the raw values.
        // Behind Traefik that means http:// and the container's own address — which is how
        // confirmation and invitation emails came to carry http:// links (ROADMAP L14).
        app.UseForwardedHeaders();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi("/api/openapi/{documentName}.json");
            app.UseDeveloperExceptionPage();
        }

        app.UseResponseCompression();

        // `.webmanifest` is not in ASP.NET's default content-type map, and an unknown extension
        // is not served at all — so without this the manifest 404s, the app is silently not
        // installable, and nothing in the logs says why. The MIME type is already in the
        // compression list above, which only ever mattered once the file could be fetched.
        var contentTypes = new FileExtensionContentTypeProvider();
        contentTypes.Mappings[".webmanifest"] = "application/manifest+json";

        app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = contentTypes });
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseAntiforgery();

        app.MapAuthEndpoints()
            .MapProjectsEndpoints()
            .MapInboxEndpoints()
            .MapSavedViewsEndpoints()
            .MapProjectMembersEndpoints()
            .MapProjectColumnsEndpoints()
            .MapProjectSectionsEndpoints()
            .MapProjectTasksEndpoints()
            .MapBulkTasksEndpoints()
            .MapTaskRemindersEndpoints()
            .MapTaskChecklistEndpoints()
            .MapTaskDependenciesEndpoints()
            .MapTaskCommentsEndpoints()
            .MapActivityEndpoints()
            .MapNotificationsEndpoints()
            .MapSearchEndpoints()
            .MapTrashEndpoints()
            .MapCalendarEndpoints()
            .MapExportEndpoints()
            .MapPushEndpoints()
            .MapImportEndpoints();

        app.MapGet(
            "/api/csrf-token",
            (IAntiforgery antiforgery, HttpContext context) =>
            {
                var tokens = antiforgery.GetAndStoreTokens(context);
                context.Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!);
                return TypedResults.NoContent();
            }
        );

        // Explicit routes win over the fallback, so this stays JSON rather than index.html.
        // Anonymous on purpose: the container probe runs before anyone can authenticate.
        app.MapGet("/health", () => TypedResults.Ok(new { status = "healthy" }))
            .AllowAnonymous()
            .ExcludeFromDescription();

        // Unmatched /api paths must not fall through to the SPA. Without this an API call to
        // a route the running process does not have — the everyday consequence of a stale
        // `dotnet run`, since new endpoints need a restart — returns 200 and index.html, and
        // the typed client hands a component an HTML *string* where it expected an array. The
        // failure then surfaces as "x.map is not a function" somewhere far from the cause.
        // Returning JSON 404 also fixes the old 405-instead-of-404 on POST/PATCH, which came
        // from the file fallback only accepting GET and HEAD.
        // Ahead of the SPA fallback, like every API route — an unmatched /hub path must not
        // come back as index.html.
        app.MapHub<RealtimeHub>("/hub/realtime");

        app.MapFallback(
                "/api/{**path}",
                (string path) =>
                    TypedResults.NotFound(new ApiMessageResponse($"No API route matches /api/{path}"))
            )
            .ExcludeFromDescription();

        app.MapFallbackToFile("index.html");
        app.Run();
    }
}
