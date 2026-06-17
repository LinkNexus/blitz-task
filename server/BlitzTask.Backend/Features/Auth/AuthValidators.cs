using FluentValidation;

namespace BlitzTask.Backend.Features.Auth
{
    public class LoginRequestValidator : AbstractValidator<LoginRequest>
    {
        public LoginRequestValidator()
        {
            RuleFor(x => x.Email).EmailAddress();
            RuleFor(x => x.Password).NotEmpty();
        }
    }

    public class RequestPasswordResetRequestValidator : AbstractValidator<RequestPasswordResetRequest>
    {
        public RequestPasswordResetRequestValidator()
        {
            RuleFor(x => x.Email).NotEmpty().EmailAddress();
        }
    }
}
