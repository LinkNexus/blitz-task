using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectMembers;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Services;
using BlitzTask.Backend.Infrastructure.Auth;
using BlitzTask.Backend.Infrastructure.Data;
using FluentValidation;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using RazorLight;
using Resend;
using SharpGrip.FluentValidation.AutoValidation.Endpoints.Extensions;

namespace BlitzTask.Backend;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

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

        builder.Services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlite(connectionString)
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

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi("/api/openapi/{documentName}.json");
            app.UseDeveloperExceptionPage();
        }

        app.UseStaticFiles();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseAntiforgery();

        app.MapAuthEndpoints()
            .MapProjectsEndpoints()
            .MapProjectMembersEndpoints()
            .MapProjectColumnsEndpoints()
            .MapProjectTasksEndpoints();

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

        app.MapFallbackToFile("index.html");
        app.Run();
    }
}
