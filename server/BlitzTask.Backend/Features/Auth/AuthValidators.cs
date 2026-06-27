using BlitzTask.Backend.Infrastructure.Data;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Auth
{
    public class LoginRequestValidator : AbstractValidator<LoginRequest>
    {
        public LoginRequestValidator()
        {
            RuleFor(x => x.Email).NotEmpty().EmailAddress();
            RuleFor(x => x.Password).NotEmpty();
        }
    }

    public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
    {
        public CreateUserRequestValidator(ApplicationDbContext dbContext)
        {
            RuleFor(x => x.Name).NotEmpty().MinimumLength(2).MaximumLength(100);

            RuleFor(x => x.Email)
                .NotEmpty()
                .EmailAddress()
                .CustomAsync(
                    async (email, context, cancellationToken) =>
                    {
                        var existingUser = await dbContext
                            .Users.Where(u => u.Email == email)
                            .Select(u => new { u.Id })
                            .FirstOrDefaultAsync(cancellationToken);
                        if (existingUser is not null)
                            context.AddFailure(
                                "Email",
                                "This email is already used by another account"
                            );
                    }
                );

            RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(255);

            RuleFor(x => x.ConfirmPassword)
                .NotEmpty()
                .Equal(x => x.Password)
                .WithMessage("Passwords do not match");
        }
    }

    public class RequestPasswordResetRequestValidator
        : AbstractValidator<RequestPasswordResetRequest>
    {
        public RequestPasswordResetRequestValidator()
        {
            RuleFor(x => x.Email).NotEmpty().EmailAddress();
        }
    }

    public class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
    {
        public ResetPasswordRequestValidator()
        {
            RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(255);

            RuleFor(x => x.ConfirmPassword)
                .NotEmpty()
                .Equal(x => x.Password)
                .WithMessage("Passwords do not match");
        }
    }
}
