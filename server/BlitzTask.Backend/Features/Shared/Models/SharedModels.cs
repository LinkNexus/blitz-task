namespace BlitzTask.Backend.Features.Shared.Models
{
    public interface ICreateable
    {
        public DateTime CreatedAt { get; set; }
    }

    public interface IAuditable : ICreateable
    {
        public DateTime UpdatedAt { get; set; }
    }

    public record ApiMessageResponse(string Message);
}
