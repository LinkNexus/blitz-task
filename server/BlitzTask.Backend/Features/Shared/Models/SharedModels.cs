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

    /// <summary>
    /// An entity that is trashed rather than destroyed. <c>DeletedAt</c> is both the flag and the
    /// clock the purge runs against — and, because a cascade stamps parent and children with the
    /// <b>same instant</b>, it is also what tells a restore which children came down with the
    /// parent and which were already in the trash on their own.
    /// </summary>
    public interface ISoftDeletable
    {
        public DateTime? DeletedAt { get; set; }
    }

    public record ApiMessageResponse(string Message);
}
