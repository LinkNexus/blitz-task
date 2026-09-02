import { IconUsers } from "@tabler/icons-react";
import type { CurrentUser, ProjectDetails } from "@/api";
import { AddProjectMemberForm } from "./add-member-form";
import { ProjectMembersInvitations } from "./invitations";
import { ProjectMembersList } from "./members-list";

type Props = {
  project: ProjectDetails;
  currentUser: CurrentUser;
};

export function ProjectMembersSection({ project, currentUser }: Props) {
  const currentParticipant = project.participants.find(
    (p) => String(p.userId) === String(currentUser.id),
  )!;
  const isOwner = currentParticipant.role === "Owner";

  const assignableRoles = isOwner
    ? (["Collaborator", "Contributor", "Viewer"] as const)
    : (["Contributor", "Viewer"] as const);

  const canManageParticipants =
    project.userPermissions?.includes("ManageParticipants") ?? false;

  return (
    <div className="space-y-4">
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <IconUsers className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          Members
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({project.participants.length})
          </span>
        </h3>
      </div>

      {/* Add member form */}
      {canManageParticipants && (
        <AddProjectMemberForm
          project={project}
          assignableRoles={assignableRoles}
        />
      )}

      {/* Member list */}
      <ProjectMembersList project={project} assignableRoles={assignableRoles} />

      {/* Pending invitations */}
      {canManageParticipants && project.invitations.length > 0 && (
        <ProjectMembersInvitations project={project} />
      )}
    </div>
  );
}
