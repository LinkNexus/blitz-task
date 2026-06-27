import { IconMailX, IconSend } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ProjectDetails } from "@/api";
import {
  getProjectQueryKey,
  revokeProjectInvitationMutation,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "../../../-components/role-badge";

type Props = {
  project: ProjectDetails;
};

function isExpiredInvitation(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > 7 * 86_400_000;
}

function formatInvitationAge(createdAt: string): string {
  const days = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 86_400_000,
  );
  if (days === 0) return "Sent today";
  if (days === 1) return "Sent yesterday";
  return `Sent ${days}d ago`;
}

export function ProjectMembersInvitations({ project }: Props) {
  const queryClient = useQueryClient();

  const revokeInvitationMut = useMutation({
    ...revokeProjectInvitationMutation(),
    onSuccess(_, variables) {
      queryClient.setQueryData(
        getProjectQueryKey({
          path: {
            projectId: Number(project.id),
          },
        }),
        (old: ProjectDetails) => ({
          ...old,
          invitations: old.invitations.filter(
            (i) => Number(i.id) !== variables.path.invitationId,
          ),
        }),
      );
    },
    onError(error) {
      toast.error(`Failed to revoke invitation`, {
        description: error.message,
      });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <IconSend className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          Pending Invitations
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({project.invitations.length})
          </span>
        </h3>
      </div>

      <ul className="space-y-2">
        {project.invitations.map((inv) => {
          const expired = isExpiredInvitation(inv.createdAt!);
          const isRevoking =
            revokeInvitationMut.isPending &&
            revokeInvitationMut.variables.path.invitationId === Number(inv.id);

          return (
            <li
              key={String(inv.id)}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {inv.guestEmail}
                </span>
                <span className="text-xs text-muted-foreground">
                  {expired ? "Expired" : formatInvitationAge(inv.createdAt!)}
                </span>
              </div>

              <RoleBadge role={inv.role} />

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Revoke invitation for ${inv.guestEmail}`}
                disabled={isRevoking}
                onClick={() =>
                  revokeInvitationMut.mutate({
                    path: {
                      projectId: Number(project.id),
                      invitationId: Number(inv.id),
                    },
                  })
                }
              >
                <IconMailX className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
