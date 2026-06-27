import { IconUserMinus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ProjectDetails, ProjectRole } from "@/api";
import {
  changeProjectMemberRoleMutation,
  getProjectQueryKey,
  removeProjectMemberMutation,
} from "@/api/@tanstack/react-query.gen";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/use-current-user";
import { getInitials } from "@/lib/utils";
import { RoleBadge } from "../../../-components/role-badge";

export function ProjectMembersList({
  project,
  assignableRoles,
}: {
  project: ProjectDetails;
  assignableRoles: readonly string[];
}) {
  const { user: currentUser } = useAccount();
  const queryClient = useQueryClient();

  const changeRoleMut = useMutation({
    ...changeProjectMemberRoleMutation(),
    onSuccess: (res) => {
      queryClient.setQueryData(
        getProjectQueryKey({
          path: {
            projectId: Number(project.id),
          },
        }),
        (old: ProjectDetails): ProjectDetails => ({
          ...old,
          participants: old.participants.map((pp) => {
            if (pp.id == res.id) return res;
            return pp;
          }),
        }),
      );

      toast.success("Participant's role changed successfully");
    },
    onError: (err) => {
      toast.error("An error occured when changing the participant's role", {
        description: err.message,
      });
    },
  });

  const removeMemberMut = useMutation({
    ...removeProjectMemberMutation(),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(
        getProjectQueryKey({
          path: {
            projectId: Number(project.id),
          },
        }),
        (old: ProjectDetails): ProjectDetails => ({
          ...old,
          participants: old.participants.filter(
            (p) => Number(p.id) !== variables.path.participantId,
          ),
        }),
      );

      toast.success("Participant removed successfully");
    },
    onError: (err) => {
      toast.error("An error occured when removing the participant", {
        description: err.message,
      });
    },
  });

  return (
    <ul className="space-y-2">
      {project.participants.map((p) => {
        const isSelf = String(p.userId) === String(currentUser.id);

        const canManageMembers =
          (p.role === "Viewer" || p.role === "Contributor") &&
          project.userPermissions?.includes("ManageParticipants");

        const canManageCollaborators =
          p.role === "Collaborator" &&
          project.userPermissions?.includes("ManageCollaborators");

        const canManage =
          !isSelf && (canManageMembers || canManageCollaborators);

        return (
          <li
            key={String(p.userId)}
            className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
          >
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-xs">
                {getInitials(p.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{p.name}</span>
              {isSelf && (
                <span className="text-xs text-muted-foreground">You</span>
              )}
            </div>

            {canManage ? (
              <Select
                value={p.role}
                onValueChange={async (v) => {
                  await changeRoleMut.mutateAsync({
                    body: {
                      role: v as ProjectRole,
                    },
                    path: {
                      projectId: Number(project.id),
                      participantId: Number(p.id),
                    },
                  });
                }}
              >
                <SelectTrigger className="h-7 w-30 shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <RoleBadge role={p.role} />
            )}

            {canManage && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${p.name}`}
                onClick={async () => {
                  await removeMemberMut.mutateAsync({
                    path: {
                      projectId: Number(project.id),
                      participantId: Number(p.id),
                    },
                  });
                }}
              >
                <IconUserMinus className="size-4" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
