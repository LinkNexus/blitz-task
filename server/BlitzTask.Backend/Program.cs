using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Services;
using BlitzTask.Backend.Infrastructure.Auth;
using BlitzTask.Backend.Infrastructure.Data;
using FluentValidation;
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

        builder.Services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection"))
        );

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

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi("/api/openapi/{documentName}.json");
            app.UseDeveloperExceptionPage();
        }

        app.UseStaticFiles();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseAntiforgery();

        app.MapAuthEndpoints().MapProjectsEndpoints();

        app.MapGet(
            "/api/csrf-token",
            (IAntiforgery antiforgery, HttpContext context) =>
            {
                var tokens = antiforgery.GetAndStoreTokens(context);
                context.Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!);
                return TypedResults.NoContent();
            }
        );

        app.MapFallbackToFile("index.html");
        app.Run();
    }
}
