using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Features.Shared.Services;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Auth
{
    public static class AuthEndpoints
    {
        public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
        {
            var authGroup = app.MapGroup("/api").WithTags("Authentication");

            authGroup
                .MapPost("/login", Login)
                .WithName("login")
                .AddEndpointFilter(ValidationFilter<LoginRequest>.Body())
                .Produces<CurrentUser>()
                .Produces<ApiMessageResponse>(StatusCodes.Status401Unauthorized)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            authGroup
                .MapGet("/me", GetCurrentUser)
                .WithName("get-current-user")
                .RequireAuthorization()
                .Produces<CurrentUser>()
                .Produces<ApiMessageResponse>(StatusCodes.Status401Unauthorized);

            authGroup
                .MapPost("/create-account", CreateAccount)
                .WithName("create-account")
                .AddEndpointFilter(ValidationFilter<CreateUserRequest>.Body())
                .Produces<CurrentUser>()
                .Produces<ApiMessageResponse>(StatusCodes.Status400BadRequest)
                .Produces<ApiMessageResponse>(StatusCodes.Status429TooManyRequests)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            authGroup
                .MapPost("/confirm-email", ConfirmEmail)
                .WithName("confirm-email")
                .AddEndpointFilter(ValidationFilter<ConfirmEmailRequest>.Body())
                .RequireRateLimiting("auth")
                .Produces<ApiMessageResponse>(StatusCodes.Status200OK)
                .Produces<ApiMessageResponse>(StatusCodes.Status400BadRequest)
                .Produces<ApiMessageResponse>(StatusCodes.Status429TooManyRequests)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            authGroup
                .MapPost("/resend-confirm-email", ResendConfirmEmail)
                .WithName("resend-confirm-email")
                .RequireAuthorization();

            authGroup
                .MapPost("/request-password-reset", RequestPasswordReset)
                .WithName("request-password-reset")
                .AddEndpointFilter(ValidationFilter<RequestPasswordResetRequest>.Body())
                // .RequireRateLimiting("auth")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            authGroup.MapPost("/logout", (Delegate)Logout).WithName("logout");

            authGroup
                .MapPost("/reset-password", ResetPassword)
                .WithName("reset-password")
                .AddEndpointFilter(ValidationFilter<ResetPasswordRequest>.Body())
                // .RequireRateLimiting("auth")
                .Produces<ApiMessageResponse>(StatusCodes.Status200OK)
                .Produces<ApiMessageResponse>(StatusCodes.Status400BadRequest)
                // .Produces<ApiMessageResponse>(StatusCodes.Status429TooManyRequests)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            return app;
        }

        private static async Task LoginUser(
            UserToken? securityStamp,
            User user,
            bool RememberMe,
            ApplicationDbContext dbContext,
            HttpContext context
        )
        {
            string securityStampToken;
            if (securityStamp is null)
            {
                securityStampToken = Guid.NewGuid().ToString();
                await dbContext.UserTokens.AddAsync(
                    new()
                    {
                        UserId = user.Id,
                        Value = securityStampToken,
                        Type = UserTokenType.SecurityStamp,
                    }
                );
                await dbContext.SaveChangesAsync();
            }
            else
            {
                securityStampToken = securityStamp.Value;
            }

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.Name),
                new(ClaimTypes.Email, user.Email),
                new("SecurityStamp", securityStampToken),
            };

            var claimsIdentity = new ClaimsIdentity(
                claims,
                CookieAuthenticationDefaults.AuthenticationScheme
            );

            var authProperties = new AuthenticationProperties
            {
                IsPersistent = RememberMe,
                ExpiresUtc = RememberMe ? DateTimeOffset.UtcNow.AddDays(7) : null,
            };

            await context.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(claimsIdentity),
                authProperties
            );
        }

        public static async Task<IResult> Login(
            LoginRequest request,
            ApplicationDbContext dbContext,
            HttpContext context
        )
        {
            var passwordHasher = new PasswordHasher<User>();

            var result = await dbContext
                .Users.Where(u => u.Email == request.Email)
                .Select(u => new
                {
                    User = u,
                    SecurityStamp = u.Tokens.FirstOrDefault(t =>
                        t.Type == UserTokenType.SecurityStamp
                    ),
                })
                .FirstOrDefaultAsync();

            if (
                result is null
                || passwordHasher.VerifyHashedPassword(
                    result.User,
                    result.User.Password,
                    request.Password
                ) != PasswordVerificationResult.Success
            )
            {
                return Results.Json(
                    new ApiMessageResponse("Invalid credentials"),
                    statusCode: StatusCodes.Status401Unauthorized
                );
            }

            await LoginUser(
                result.SecurityStamp,
                result.User,
                request.RememberMe,
                dbContext,
                context
            );
            return Results.Ok(result.User.ToCurrentUser());
        }

        public static async Task<IResult> GetCurrentUser(
            HttpContext httpContext,
            ApplicationDbContext context
        )
        {
            var user = httpContext.GetUser();

            if (user is null)
            {
                return Results.Json(
                    new ApiMessageResponse(
                        "Unauthorized access, please login to access this resource"
                    ),
                    statusCode: StatusCodes.Status401Unauthorized
                );
            }

            return Results.Ok(user.ToCurrentUser());
        }

        private static async Task SendVerificationEmail(
            User user,
            UserToken? token,
            [FromServices] ApplicationDbContext dbContext,
            HttpContext context,
            [FromServices] MailerService mailerService
        )
        {
            var tokenValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            if (token is null)
            {
                token = new UserToken
                {
                    User = user,
                    Value = tokenValue,
                    Type = UserTokenType.EmailConfirmation,
                    ExpiresAt = DateTime.UtcNow.AddHours(24),
                };
                await dbContext.UserTokens.AddAsync(token);
            }
            else
            {
                token.Value = tokenValue;
                token.ExpiresAt = DateTime.UtcNow.AddHours(24);
            }

            await dbContext.SaveChangesAsync();

            var encodedToken = WebUtility.UrlEncode(token.Value);
            var confirmationLink =
                $"{context.Request.Scheme}://{context.Request.Host}/confirm-email?token={encodedToken}&userId={user.Id}";

            await mailerService.SendEmailAsync(
                new EmailMessage(
                    To: [user.Email],
                    Subject: "Confirm your email address",
                    TemplateName: "ConfirmEmail",
                    TemplateModel: new ConfirmEmailModel
                    {
                        UserName = user.Name,
                        ConfirmationLink = confirmationLink,
                    }
                )
            );
        }

        public static async Task<IResult> CreateAccount(
            CreateUserRequest request,
            HttpContext context,
            [FromServices] ApplicationDbContext dbContext,
            [FromServices] MailerService mailerService
        )
        {
            var user = new User
            {
                Name = request.Name,
                Email = request.Email,
                EmailConfirmed = false,
                Password = null!,
            };

            var passwordHasher = new PasswordHasher<User>();
            user.Password = passwordHasher.HashPassword(user, request.Password);

            dbContext.Users.Add(user);
            var result = await dbContext.SaveChangesAsync() > 0;

            if (!result)
            {
                return Results.BadRequest(
                    new ApiMessageResponse(
                        "An error occurred while creating the account, try again later"
                    )
                );
            }

            await SendVerificationEmail(user, null, dbContext, context, mailerService);
            await LoginUser(null, user, false, dbContext, context);

            return Results.Ok(user.ToCurrentUser());
        }

        public static async Task<IResult> ConfirmEmail(
            ConfirmEmailRequest request,
            ApplicationDbContext dbContext
        )
        {
            var result = await dbContext
                .Users.Where(u => u.Id == request.UserId)
                .Select(u => new
                {
                    User = u,
                    ConfirmEmailToken = u.Tokens.FirstOrDefault(t =>
                        t.Type == UserTokenType.EmailConfirmation
                        && t.Value == request.Token
                        && t.ExpiresAt >= DateTime.UtcNow
                    ),
                })
                .FirstOrDefaultAsync();

            if (result is null)
                return Results.NotFound(
                    new ApiMessageResponse(
                        "The user associated with this confirmation token was not found"
                    )
                );

            if (result.User.EmailConfirmed)
                return Results.BadRequest(new ApiMessageResponse("Email is already confirmed"));

            if (result.ConfirmEmailToken is null)
                return Results.BadRequest(
                    new ApiMessageResponse(
                        "The confirmation token is invalid or has expired, please request a new confirmation email"
                    )
                );

            result.User.EmailConfirmed = true;
            dbContext.UserTokens.Remove(result.ConfirmEmailToken);
            await dbContext.SaveChangesAsync();
            return Results.Ok(new ApiMessageResponse("Your email has been successfully confirmed"));
        }

        public static async Task<Ok<ApiMessageResponse>> ResendConfirmEmail(
            HttpContext context,
            ApplicationDbContext dbContext,
            MailerService mailerService
        )
        {
            var user = context.GetUser();
            var token = await dbContext.UserTokens.FirstOrDefaultAsync(t =>
                t.UserId == user.Id && t.Type == UserTokenType.EmailConfirmation
            );

            if (user.EmailConfirmed)
                return TypedResults.Ok(new ApiMessageResponse("Your email is already confirmed"));

            await SendVerificationEmail(user, token, dbContext, context, mailerService);

            return TypedResults.Ok(
                new ApiMessageResponse(
                    "A new confirmation email has been sent to your email address"
                )
            );
        }

        public static async Task<NoContent> Logout(HttpContext context)
        {
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return TypedResults.NoContent();
        }

        public static async Task<IResult> RequestPasswordReset(
            RequestPasswordResetRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            [FromServices] MailerService mailerService
        )
        {
            var result = await dbContext
                .Users.Where(u => u.Email == request.Email)
                .Select(u => new
                {
                    User = u,
                    PasswordResetToken = u.Tokens.FirstOrDefault(t =>
                        t.Type == UserTokenType.PasswordReset
                    ),
                })
                .FirstOrDefaultAsync();

            if (result is not null)
                await SendPasswordResetEmail(
                    result.User,
                    result.PasswordResetToken,
                    dbContext,
                    context,
                    mailerService
                );

            return Results.NoContent();
        }

        private static async Task SendPasswordResetEmail(
            User user,
            UserToken? token,
            ApplicationDbContext dbContext,
            HttpContext context,
            MailerService mailerService
        )
        {
            var tokenValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            if (token is null)
            {
                token = new UserToken
                {
                    User = user,
                    Value = tokenValue,
                    Type = UserTokenType.PasswordReset,
                    ExpiresAt = DateTime.UtcNow.AddHours(24),
                };
                await dbContext.UserTokens.AddAsync(token);
            }
            else
            {
                token.Value = tokenValue;
                token.ExpiresAt = DateTime.UtcNow.AddHours(24);
            }

            await dbContext.SaveChangesAsync();

            var encodedToken = WebUtility.UrlEncode(token.Value);
            var resetLink =
                $"{context.Request.Scheme}://{context.Request.Host}/reset-password?token={encodedToken}&userId={user.Id}";

            await mailerService.SendEmailAsync(
                new EmailMessage(
                    To: [user.Email],
                    Subject: "Reset your password",
                    TemplateName: "PasswordReset",
                    TemplateModel: new PasswordResetModel
                    {
                        UserName = user.Name,
                        ResetLink = resetLink,
                    }
                )
            );
        }

        public static async Task<IResult> ResetPassword(
            ResetPasswordRequest request,
            ApplicationDbContext dbContext
        )
        {
            var result = await dbContext
                .Users.Where(u => u.Id == request.UserId)
                .Select(u => new
                {
                    User = u,
                    PasswordResetToken = u.Tokens.FirstOrDefault(t =>
                        t.Type == UserTokenType.PasswordReset
                        && t.Value == request.Token
                        && t.ExpiresAt >= DateTime.UtcNow
                    ),
                })
                .FirstOrDefaultAsync();

            if (result is null)
                return Results.NotFound(
                    new ApiMessageResponse(
                        "The user associated with this password reset token was not found"
                    )
                );

            if (result.PasswordResetToken is null)
                return Results.BadRequest(
                    new ApiMessageResponse(
                        "The password reset token is invalid or has expired, please request a new password reset email"
                    )
                );

            var passwordHasher = new PasswordHasher<User>();
            result.User.Password = passwordHasher.HashPassword(result.User, request.Password);
            dbContext.UserTokens.Remove(result.PasswordResetToken);
            await dbContext.SaveChangesAsync();
            return Results.NoContent();
        }
    }
}
