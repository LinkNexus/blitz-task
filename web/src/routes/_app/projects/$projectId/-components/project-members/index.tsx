import { IconUserMinus, IconUsers } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CurrentUser, ProjectDetails } from "@/api";
import { getProjectQueryKey } from "@/api/@tanstack/react-query.gen";
import { client } from "@/api/client.gen";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInitials } from "@/lib/utils";
import { RoleBadge } from "../../../-components/role-badge";
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

  const handleChangeRole = (_userId: number | string, _newRole: string) => {
    // TODO: wire to PUT /api/projects/{projectId}/members/{userId}
    toast.info("Member management coming soon");
  };

  const handleRemoveMember = (_userId: number | string) => {
    // TODO: wire to DELETE /api/projects/{projectId}/members/{userId}
    toast.info("Member management coming soon");
  };

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
