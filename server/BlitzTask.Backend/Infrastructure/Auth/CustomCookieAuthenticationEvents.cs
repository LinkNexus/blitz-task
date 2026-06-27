using System.Security.Claims;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Infrastructure.Auth
{
    public class CustomCookieAuthenticationEvents : CookieAuthenticationEvents
    {
        public override async Task ValidatePrincipal(CookieValidatePrincipalContext context)
        {
            var userIdClaim = context.Principal?.FindFirst(ClaimTypes.NameIdentifier);
            var securityStampClaim = context.Principal?.FindFirst("SecurityStamp");

            if (userIdClaim is null || !int.TryParse(userIdClaim.Value, out int userId))
            {
                context.RejectPrincipal();
                return;
            }

            var dbContext =
                context.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();

            var result = await dbContext
                .Users.Where(u => u.Id == userId)
                .Select(u => new
                {
                    User = u,
                    Token = u.Tokens.FirstOrDefault(t => t.Type == UserTokenType.SecurityStamp),
                })
                .FirstOrDefaultAsync();

            if (result is null || result.User is null)
            {
                context.RejectPrincipal();
                return;
            }

            if (securityStampClaim is null || securityStampClaim.Value != result.Token?.Value)
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(
                    CookieAuthenticationDefaults.AuthenticationScheme
                );
            }

            context.HttpContext.Items["CurrentUser"] = result.User;
        }
    }
}
