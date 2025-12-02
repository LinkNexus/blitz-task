import {Loader2, Mail, MailX, MoreHorizontal} from "lucide-react";
import {memo, useEffect, useState} from "react";
import {toast} from "sonner";
import {Avatar, AvatarFallback} from "@/components/ui/avatar";
import {Button} from "@/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from "@/components/ui/dropdown-menu";
import {ScrollArea} from "@/components/ui/scroll-area";
import {useApiFetch} from "@/hooks/use-api-fetch";
import {getInitials} from "@/lib/utils";
import type {Project, ProjectInvitation} from "@/types";
import {confirmAction} from "../../confirm-action-modal";

export const PendingInvitesTab = memo(({id}: Pick<Project, "id">) => {
  const [invites, setInvites] = useState<ProjectInvitation[]>([]);

  const {pending: fetching, action: getInvites} = useApiFetch<
    ProjectInvitation[]
  >({
    url: `/api/projects/${id}/invitations`,
    options: {
      onSuccess(res) {
        setInvites(res.data);
      },
    },
    deps: [id],
  });

  const {pending: revoking, action: revokeInvite} = useApiFetch<
    { id: number },
    { message: string }
  >({
    url: "/api/projects/invitations/revoke/:id",
    options: {
      method: "POST",
      onSuccess(res) {
        setInvites((prev) =>
          prev.filter((invite) => invite.id !== res.data.id),
        );
        toast.success("Invitation revoked successfully.");
      },
      onError(e) {
        toast.error("An error happened when trying to revoke the invitation", {
          description: e.response.data.message,
          closeButton: true,
        });
      },
    },
    deps: [id],
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    getInvites();
  }, [id]);

  if (fetching) {
    return (
      <div className="h-full flex justify-center items-center">
        <Loader2 className="animate-spin size-6"/>
      </div>
    )
  }

  return (
    <ScrollArea className="max-h-72 overflow-y-auto">
      <div className="space-y-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="size-10">
                <AvatarFallback className="text-sm font-medium">
                  {getInitials(invite.guestEmail)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {invite.guestEmail}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sent on {new Date(invite.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {revoking ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground ml-2"/>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="size-4"/>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      confirmAction({
                        async action() {
                          await revokeInvite({
                            params: {id: invite.id},
                          });
                        },
                        title: "Revoke Invitation",
                        description: `Are you sure you want to revoke the invitation for ${invite.guestEmail}? This action cannot be undone.`,
                      });
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <MailX className="size-4 text-destructive"/>
                    Revoke
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}

        {invites.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="size-12 mx-auto mb-3 opacity-50"/>
            <p className="text-sm">No pending invitations</p>
            <p className="text-xs">
              Invite team members to see pending invitations here
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
});
