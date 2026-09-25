using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BlitzTask.Backend.Features.Push
{
    public static class PushEndpoints
    {
        public static IEndpointRouteBuilder MapPushEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/push")
                .WithTags("Push")
                .RequireAuthorization("EmailConfirmed");

            group
                .MapGet("/configuration", GetConfiguration)
                .WithName("get-push-configuration")
                .Produces<PushConfiguration>();

            group
                .MapPost("/subscriptions", Subscribe)
                .WithName("create-push-subscription")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status400BadRequest);

            group
                .MapDelete("/subscriptions", Unsubscribe)
                .WithName("delete-push-subscription")
                .Produces(StatusCodes.Status204NoContent);

            return app;
        }

        /// <summary>
        /// The public key the browser needs to subscribe, or null when this instance has no
        /// keypair — which is how the client knows to hide the feature rather than offer a
        /// switch that cannot work.
        /// </summary>
        public static Ok<PushConfiguration> GetConfiguration(IOptions<PushSettings> settings) =>
            TypedResults.Ok(
                new PushConfiguration(
                    settings.Value.IsConfigured ? settings.Value.PublicKey : null
                )
            );

        public static async Task<
            Results<NoContent, BadRequest<ApiMessageResponse>>
        > Subscribe(
            PushSubscriptionRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            IOptions<PushSettings> settings,
            CancellationToken cancellationToken
        )
        {
            if (!settings.Value.IsConfigured)
            {
                return TypedResults.BadRequest(
                    new ApiMessageResponse("This instance has no push keys configured")
                );
            }

            var user = context.GetUser();

            // The browser hands back the same endpoint when it re-subscribes, and the keys can
            // change underneath it — so this updates the device's row rather than adding a
            // second one that would buzz alongside the first.
            var existing = await dbContext.PushSubscriptions.FirstOrDefaultAsync(
                s => s.Endpoint == request.Endpoint,
                cancellationToken
            );

            if (existing is not null)
            {
                existing.UserId = user.Id;
                existing.P256dh = request.P256dh;
                existing.Auth = request.Auth;
            }
            else
            {
                dbContext.PushSubscriptions.Add(
                    new PushSubscription
                    {
                        UserId = user.Id,
                        Endpoint = request.Endpoint,
                        P256dh = request.P256dh,
                        Auth = request.Auth,
                    }
                );
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.NoContent();
        }

        public static async Task<NoContent> Unsubscribe(
            string endpoint,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            // Scoped to the caller: one person must not be able to silence another's phone by
            // guessing an endpoint.
            await dbContext
                .PushSubscriptions.Where(s => s.Endpoint == endpoint && s.UserId == user.Id)
                .ExecuteDeleteAsync(cancellationToken);

            return TypedResults.NoContent();
        }
    }
}
