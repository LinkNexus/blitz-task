using BlitzTask.Backend.Features.Projects;

namespace BlitzTask.Backend.Tests.Features.Projects;

/// <summary>
/// The role→permission matrix in <see cref="ProjectPermissions"/> is the single place project
/// authorization is decided (RequireProjectPermissionFilter reads nothing else), so a wrong
/// entry silently grants or denies access across every endpoint at once.
/// </summary>
public class ProjectPermissionsTests
{
    public static TheoryData<ProjectRole, ProjectPermission[]> ExpectedMatrix =>
        new()
        {
            {
                ProjectRole.Owner,
                [
                    ProjectPermission.EditProject,
                    ProjectPermission.DeleteProject,
                    ProjectPermission.ManageParticipants,
                    ProjectPermission.ManageCollaborators,
                    ProjectPermission.PromoteToCollaborator,
                    ProjectPermission.ManageColumns,
                    ProjectPermission.ManageTasks,
                ]
            },
            {
                ProjectRole.Collaborator,
                [
                    ProjectPermission.EditProject,
                    ProjectPermission.ManageParticipants,
                    ProjectPermission.ManageColumns,
                    ProjectPermission.ManageTasks,
                ]
            },
            { ProjectRole.Contributor, [ProjectPermission.ManageTasks] },
            { ProjectRole.Viewer, [] },
        };

    [Theory]
    [MemberData(nameof(ExpectedMatrix))]
    public void GetPermissions_ReturnsExactlyTheExpectedSet(
        ProjectRole role,
        ProjectPermission[] expected
    )
    {
        var actual = role.GetPermissions();

        Assert.Equal(expected.Length, actual.Count);
        Assert.Equal([.. expected.OrderBy(p => p)], actual.OrderBy(p => p));
    }

    [Theory]
    [MemberData(nameof(ExpectedMatrix))]
    public void HasPermission_AgreesWithGetPermissions_ForEveryPermission(
        ProjectRole role,
        ProjectPermission[] expected
    )
    {
        foreach (var permission in Enum.GetValues<ProjectPermission>())
        {
            Assert.Equal(expected.Contains(permission), role.HasPermission(permission));
        }
    }

    [Theory]
    [InlineData(ProjectPermission.DeleteProject)]
    [InlineData(ProjectPermission.ManageCollaborators)]
    [InlineData(ProjectPermission.PromoteToCollaborator)]
    public void OwnerOnlyPermissions_AreHeldByNobodyElse(ProjectPermission permission)
    {
        Assert.True(ProjectRole.Owner.HasPermission(permission));

        foreach (var role in Enum.GetValues<ProjectRole>().Where(r => r != ProjectRole.Owner))
        {
            Assert.False(role.HasPermission(permission));
        }
    }

    [Fact]
    public void Viewer_HasNoPermissionsAtAll()
    {
        Assert.Empty(ProjectRole.Viewer.GetPermissions());

        foreach (var permission in Enum.GetValues<ProjectPermission>())
        {
            Assert.False(ProjectRole.Viewer.HasPermission(permission));
        }
    }

    [Fact]
    public void EveryRoleHasAnEntryInTheMatrix()
    {
        // A role missing from the dictionary falls through to "no permissions" rather than
        // throwing, so adding a role and forgetting to map it would fail silently and only
        // show up as mysterious 403s.
        var mappedRoles = ExpectedMatrix.Select(row => (ProjectRole)row[0]!).ToHashSet();
        Assert.Equal(Enum.GetValues<ProjectRole>().ToHashSet(), mappedRoles);
    }

    [Fact]
    public void EveryPermissionIsGrantedToAtLeastOneRole()
    {
        // A permission no role holds is dead weight: any endpoint guarded by it is unreachable.
        foreach (var permission in Enum.GetValues<ProjectPermission>())
        {
            Assert.Contains(
                Enum.GetValues<ProjectRole>(),
                role => role.HasPermission(permission)
            );
        }
    }

    [Fact]
    public void PermissionsWiden_AsRolesGetMorePrivileged()
    {
        // Viewer ⊂ Contributor ⊂ Collaborator ⊂ Owner — the roles are a strict hierarchy, and
        // an entry that breaks it (e.g. a Contributor-only permission) is almost certainly a bug.
        var viewer = ProjectRole.Viewer.GetPermissions().ToHashSet();
        var contributor = ProjectRole.Contributor.GetPermissions().ToHashSet();
        var collaborator = ProjectRole.Collaborator.GetPermissions().ToHashSet();
        var owner = ProjectRole.Owner.GetPermissions().ToHashSet();

        Assert.ProperSubset(contributor, viewer);
        Assert.ProperSubset(collaborator, contributor);
        Assert.ProperSubset(owner, collaborator);
    }
}
