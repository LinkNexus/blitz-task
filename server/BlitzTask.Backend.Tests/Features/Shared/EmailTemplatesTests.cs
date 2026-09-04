using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectMembers;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RazorLight;

namespace BlitzTask.Backend.Tests.Features.Shared;

/// <summary>
/// Renders every email template against its real model.
/// <para>
/// These are compiled at *runtime* by RazorLight, so a template that does not compile — a typo
/// in a model property, a layout that cannot be found — is invisible to the C# build and fails
/// only at send time, in production, inside a background job whose exception handler swallows
/// it into a log line. This is the only thing standing between that and a green build.
/// </para>
/// </summary>
public class EmailTemplatesTests
{
    private sealed class CapturingMailer(AppSettings settings)
        : MailerService(
            new RazorLightEngineBuilder()
                .UseFileSystemProject(Path.Combine(AppContext.BaseDirectory, "Templates", "Email"))
                .UseMemoryCachingProvider()
                .Build(),
            Options.Create(settings),
            NullLogger.Instance
        )
    {
        public string Html { get; private set; } = string.Empty;

        protected override Task SendEmailInternalAsync(EmailMessage message, string htmlBody)
        {
            Html = htmlBody;
            return Task.CompletedTask;
        }
    }

    private static async Task<string> RenderAsync(string templateName, object model)
    {
        var mailer = new CapturingMailer(
            new AppSettings { Name = "Blitz Task", SupportEmail = "contact@example.com" }
        );
        await mailer.SendEmailAsync(
            new EmailMessage(
                To: ["someone@example.com"],
                Subject: "s",
                TemplateName: templateName,
                TemplateModel: model
            )
        );
        return mailer.Html;
    }

    public static TheoryData<string, object, string> Templates =>
        new()
        {
            {
                "ConfirmEmail",
                new ConfirmEmailModel
                {
                    UserName = "Ada",
                    ConfirmationLink = "https://blitz.example.com/confirm-email?token=t",
                },
                "https://blitz.example.com/confirm-email?token=t"
            },
            {
                "PasswordReset",
                new PasswordResetModel
                {
                    UserName = "Ada",
                    ResetLink = "https://blitz.example.com/reset-password?token=t",
                },
                "https://blitz.example.com/reset-password?token=t"
            },
            {
                "ProjectInvitation",
                new ProjectInvitationModel
                {
                    InviterName = "Grace",
                    ProjectName = "Apollo",
                    Role = "Collaborator",
                    InvitationLink = "https://blitz.example.com/projects/respond-invitation/t",
                },
                "https://blitz.example.com/projects/respond-invitation/t"
            },
            {
                "TaskReminder",
                new TaskReminderEmailModel(
                    "Ada",
                    "Ship it",
                    "Apollo",
                    "tomorrow",
                    "https://blitz.example.com/projects/1"
                ),
                "https://blitz.example.com/projects/1"
            },
        };

    [Theory]
    [MemberData(nameof(Templates))]
    public async Task RendersWithItsLinkAndTheSharedChrome(
        string templateName,
        object model,
        string expectedLink
    )
    {
        var html = await RenderAsync(templateName, model);

        Assert.Contains(expectedLink, html);
        // Chrome comes from _Layout via the viewBag, so this also proves the layout resolved —
        // a missing layout renders the body alone, silently and without the footer.
        Assert.Contains("Blitz Task", html);
        Assert.Contains("contact@example.com", html);
        Assert.Contains("</html>", html);
    }

    [Fact]
    public async Task OmitsTheSupportLineWhenNoAddressIsConfigured()
    {
        // No default address exists to fall back on — one hardcoded here would ship in a public
        // repo — so an unconfigured instance must drop the line rather than render an empty
        // mailto: link.
        var mailer = new CapturingMailer(new AppSettings { Name = "Blitz Task" });
        await mailer.SendEmailAsync(
            new EmailMessage(
                To: ["a@b.c"],
                Subject: "s",
                TemplateName: "ConfirmEmail",
                TemplateModel: new ConfirmEmailModel
                {
                    UserName = "Ada",
                    ConfirmationLink = "https://x/y",
                }
            )
        );

        Assert.DoesNotContain("Need help?", mailer.Html);
        Assert.DoesNotContain("mailto:", mailer.Html);
        // The rest of the footer still renders.
        Assert.Contains("Blitz Task", mailer.Html);
    }

    [Fact]
    public async Task BrandAndSupportAddressComeFromConfiguration()
    {
        // Not baked into the markup: a fork or a second deployment must not tell its users to
        // write to this instance's maintainer.
        var mailer = new CapturingMailer(
            new AppSettings { Name = "Task Forge", SupportEmail = "help@forge.test" }
        );
        await mailer.SendEmailAsync(
            new EmailMessage(
                To: ["a@b.c"],
                Subject: "s",
                TemplateName: "PasswordReset",
                TemplateModel: new PasswordResetModel { UserName = "Ada", ResetLink = "https://x/y" }
            )
        );

        Assert.Contains("Task Forge", mailer.Html);
        Assert.Contains("help@forge.test", mailer.Html);
        Assert.DoesNotContain("Blitz Task", mailer.Html);
    }
}
