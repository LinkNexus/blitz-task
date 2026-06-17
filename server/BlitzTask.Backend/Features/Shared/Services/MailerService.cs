using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using RazorLight;
using Resend;

namespace BlitzTask.Backend.Features.Shared.Services
{
    public record EmailMessage(
        string[] To,
        string Subject,
        string? HtmlBody = null,
        string? TemplateName = null,
        object? TemplateModel = null
    );

    public abstract class MailerService(RazorLightEngine razorEngine, ILogger logger)
    {
        public async Task SendEmailAsync(EmailMessage message)
        {
            var htmlBody = await GetRenderedHtmlBodyAsync(message);
            await SendEmailInternalAsync(message, htmlBody);
        }

        private async Task<string> GetRenderedHtmlBodyAsync(EmailMessage message)
        {
            var htmlBody = message.HtmlBody;

            if (string.IsNullOrEmpty(message.TemplateName) || message.TemplateModel == null)
                return string.IsNullOrEmpty(htmlBody)
                    ? throw new ArgumentException(
                        "Either HtmlBody or TemplateName with TemplateModel must be provided"
                    )
                    : htmlBody;
            try
            {
                htmlBody = await razorEngine.CompileRenderAsync(
                    message.TemplateName,
                    message.TemplateModel
                );
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Failed to render email template {TemplateName}",
                    message.TemplateName
                );
                throw;
            }

            return string.IsNullOrEmpty(htmlBody)
                ? throw new ArgumentException(
                    "Either HtmlBody or TemplateName with TemplateModel must be provided"
                )
                : htmlBody;
        }

        protected abstract Task SendEmailInternalAsync(EmailMessage message, string htmlBody);
    }

    public class SmtpSettings
    {
        public string Host { get; set; } = string.Empty;
        public int Port { get; set; }
        public string? Username { get; set; }
        public string? Password { get; set; }
        public string FromEmail { get; set; } = string.Empty;
        public string FromName { get; set; } = string.Empty;
    }

    public class ResendSettings
    {
        public string FromEmail { get; set; } = string.Empty;
        public string FromName { get; set; } = string.Empty;
    }

    public class SmtpMailerService(
        IOptions<SmtpSettings> settings,
        RazorLightEngine razorEngine,
        ILogger<SmtpMailerService> logger
    ) : MailerService(razorEngine, logger)
    {
        private readonly SmtpSettings _settings = settings.Value;

        protected override async Task SendEmailInternalAsync(EmailMessage message, string htmlBody)
        {
            var mimeMessage = new MimeMessage();
            mimeMessage.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));

            foreach (var to in message.To)
                mimeMessage.To.Add(MailboxAddress.Parse(to));

            mimeMessage.Subject = message.Subject;

            var bodyBuilder = new BodyBuilder { HtmlBody = htmlBody };
            mimeMessage.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            try
            {
                await client.ConnectAsync(_settings.Host, _settings.Port, SecureSocketOptions.None);

                if (
                    !string.IsNullOrEmpty(_settings.Username)
                    && !string.IsNullOrEmpty(_settings.Password)
                )
                    await client.AuthenticateAsync(_settings.Username, _settings.Password);

                await client.SendAsync(mimeMessage);
                await client.DisconnectAsync(true);

                logger.LogInformation(
                    "Email sent successfully to {Recipients} via SMTP",
                    string.Join(", ", message.To)
                );
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Failed to send email to {Recipients} via SMTP",
                    string.Join(", ", message.To)
                );
                throw;
            }
        }
    }

    public class ResendMailerService(
        IResend resend,
        IOptions<ResendSettings> settings,
        RazorLightEngine razorEngine,
        ILogger<ResendMailerService> logger
    ) : MailerService(razorEngine, logger)
    {
        private readonly ResendSettings _settings = settings.Value;

        protected override async Task SendEmailInternalAsync(EmailMessage message, string htmlBody)
        {
            var fromAddress = string.IsNullOrEmpty(_settings.FromName)
                ? _settings.FromEmail
                : $"{_settings.FromName} <{_settings.FromEmail}>";

            var emailMessage = new Resend.EmailMessage
            {
                From = fromAddress,
                To = message.To,
                Subject = message.Subject,
                HtmlBody = htmlBody,
            };

            try
            {
                var response = await resend.EmailSendAsync(emailMessage);
                logger.LogInformation(
                    "Email sent successfully to {Recipients} via Resend. Response: {@Response}",
                    string.Join(", ", message.To),
                    response
                );
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Failed to send email to {Recipients} via Resend",
                    string.Join(", ", message.To)
                );
                throw;
            }
        }
    }
}
