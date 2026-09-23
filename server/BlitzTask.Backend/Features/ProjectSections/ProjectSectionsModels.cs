using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.ProjectSections
{
    /// <summary>
    /// A named part of a project — <c>frontend</c>, <c>backend</c>, <c>infra</c> — so one
    /// repo-shaped project stops being a single flat board (L40.5).
    /// <para>
    /// <b>A section, not a nested project.</b> A <c>ParentProjectId</c> on <see cref="Project"/>
    /// is the obvious shape and the wrong one: <c>RequireProjectPermissionFilter</c> resolves a
    /// participant by <c>projectId</c>, and every membership filter in the app is
    /// <c>Participants.Any(...)</c> against a task's single project. Nesting turns all of them
    /// into ancestor walks — destabilising the one security boundary this app has — and buys
    /// per-module permissions that a frontend/backend split does not want anyway, since the same
    /// people work across both. This shape leaves RBAC untouched entirely.
    /// </para>
    /// <para>
    /// <b>Not <see cref="ISoftDeletable"/>, unlike a column.</b> Removing a section is a
    /// structural edit rather than throwing work away: its tasks stay exactly where they are and
    /// simply stop belonging to a section. There is nothing to restore, so there is nothing to
    /// put in the trash.
    /// </para>
    /// </summary>
    public class ProjectSection : IAuditable
    {
        public const int MaxNameLength = 60;

        public int Id { get; set; }
        public int ProjectId { get; set; }
        public required string Name { get; set; }
        public required string Color { get; set; }

        /// <summary>
        /// Float, like a column's, so a section can be dropped between two others without
        /// renumbering the rest. Sections render lowest first, matching columns.
        /// </summary>
        public float Score { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public Project Project { get; set; } = null!;
    }

    public record ProjectSectionDetails(int Id, string Name, string Color, float Score);

    public record CreateProjectSectionRequest(string Name, string Color, float Score);

    public record UpdateProjectSectionRequest(string Name, string Color, float Score);
}
