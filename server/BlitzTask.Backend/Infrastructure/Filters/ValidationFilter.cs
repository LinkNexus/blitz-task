using BlitzTask.Backend.Features.Shared.Models;
using FluentValidation;

namespace BlitzTask.Backend.Infrastructure.Filters
{
    public class ValidationFilter<T>(string on) : IEndpointFilter
    {
        public static ValidationFilter<T> Body() => new("body");

        public static ValidationFilter<T> Query() => new("query");

        public static ValidationFilter<T> Params() => new("params");

        public async ValueTask<object?> InvokeAsync(
            EndpointFilterInvocationContext context,
            EndpointFilterDelegate next
        )
        {
            var validator = context.HttpContext.RequestServices.GetService<IValidator<T>>();
            if (validator is null)
                return await next(context);

            var entity = context.Arguments.OfType<T>().FirstOrDefault();
            if (entity is null)
                return await next(context);

            var result = await validator.ValidateAsync(entity);
            if (!result.IsValid)
            {
                return Results.Json(
                    new ValidationErrors(
                        on,
                        result.Errors.Select(e => new ValidationError(
                            string.IsNullOrEmpty(e.PropertyName) ? "root" : e.PropertyName,
                            e.ErrorMessage
                        ))
                    ),
                    statusCode: StatusCodes.Status422UnprocessableEntity
                );
            }

            return await next(context);
        }
    }
}
