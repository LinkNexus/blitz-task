using BlitzTask.Backend.Features.Auth;
using FluentValidation.TestHelper;

namespace BlitzTask.Backend.Tests.Features.Auth;

public class LoginRequestValidatorTests
{
    private readonly LoginRequestValidator _validator = new();

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("")]
    [InlineData("missingdomain@")]
    public void Should_HaveEmailError_When_EmailIsInvalid(string email)
    {
        var result = _validator.TestValidate(new LoginRequest(email, "password", false));
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Should_HavePasswordError_When_PasswordIsEmpty()
    {
        var result = _validator.TestValidate(new LoginRequest("user@example.com", "", false));
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void Should_NotHaveErrors_When_RequestIsValid()
    {
        var result = _validator.TestValidate(new LoginRequest("user@example.com", "password123", false));
        result.ShouldNotHaveAnyValidationErrors();
    }
}

public class RequestPasswordResetRequestValidatorTests
{
    private readonly RequestPasswordResetRequestValidator _validator = new();

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("missingdomain@")]
    public void Should_HaveEmailError_When_EmailIsInvalidOrEmpty(string email)
    {
        var result = _validator.TestValidate(new RequestPasswordResetRequest(email));
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Should_NotHaveErrors_When_EmailIsValid()
    {
        var result = _validator.TestValidate(new RequestPasswordResetRequest("user@example.com"));
        result.ShouldNotHaveAnyValidationErrors();
    }
}
