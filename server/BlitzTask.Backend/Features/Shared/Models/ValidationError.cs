namespace BlitzTask.Backend.Features.Shared.Models
{
    public record ValidationError(string Path, string Message);

    public record ValidationErrors(string On, IEnumerable<ValidationError> Errors);
}
