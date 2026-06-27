import { IconBuildingSkyscraper } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import {
  getProjectInvitationOptions,
  getProjectOptions,
  respondInvitationMutation,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAccount } from "@/hooks/use-current-user";
import { flashMessagesStore } from "@/lib/store";
import { RoleBadge } from "../-components/role-badge";

export const Route = createFileRoute(
  "/_app/projects/respond-invitation/$invitationToken",
)({
  loader: ({ params, context }) => {
    const { invitationToken } = params;
    return context.queryClient.ensureQueryData(
      getProjectInvitationOptions({
        path: {
          invitationToken: invitationToken,
        },
      }),
    );
  },
  errorComponent: () => {
    return <Navigate to="/dashboard" replace />;
  },
  component: RespondToInvitationPage,
  pendingComponent: () => (
    <PageShell>
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 py-14">
          <Spinner className="size-7" />
          <p className="text-sm text-muted-foreground">Loading invitation…</p>
        </CardContent>
      </Card>
    </PageShell>
  ),
});

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-6">
      {children}
    </div>
  );
}

function RespondToInvitationPage() {
  const navigate = Route.useNavigate();
  const { invitationToken } = Route.useParams();

  const { data: invitation } = useSuspenseQuery(
    getProjectInvitationOptions({
      path: {
        invitationToken,
      },
    }),
  );

  const { user } = useAccount();
  const emailMismatch = user.email !== invitation.guestEmail;

  const [choice, setChoice] = useState<boolean>();

  const respondToInvitationMut = useMutation({
    ...respondInvitationMutation(),
    onSuccess: async (res) => {
      if (res) {
        flashMessagesStore.actions.addSingle({
          type: "success",
          message: {
            title: `You are now ${invitation.role} of the project ${invitation.projectName}`,
          },
        });

        await navigate({
          to: "/projects/$projectId",
          params: {
            projectId: String(invitation.projectId),
          },
        });
      } else {
        await navigate({
          to: "/dashboard",
        });
      }
    },
    onError: async (err) => {
      flashMessagesStore.actions.addSingle({
        type: "error",
        message: {
          title: "An error occured",
          description: err.message,
        },
      });

      await navigate({
        to: "/dashboard",
      });
    },
  });

  return (
    <PageShell>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center pb-2">
          <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-primary/10">
            <IconBuildingSkyscraper className="size-5 text-primary" />
          </div>
          <CardTitle className="text-lg">You&apos;re invited!</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join{" "}
            <strong className="text-foreground">
              {invitation.projectName}
            </strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-muted/40 py-3">
            <span className="text-xs text-muted-foreground">Your role</span>
            <RoleBadge role={invitation.role} />
          </div>

          {emailMismatch && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
              This invitation was sent to{" "}
              <strong>{invitation.guestEmail}</strong>, but you&apos;re signed
              in as <strong>{user.email}</strong>.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                setChoice(true);
                respondToInvitationMut.mutate({
                  path: {
                    invitationToken,
                  },
                  query: {
                    accepted: true,
                  },
                });
              }}
              disabled={respondToInvitationMut.isPending || emailMismatch}
            >
              {respondToInvitationMut.isPending && choice ? (
                <>
                  <Spinner />
                  Accepting…
                </>
              ) : (
                "Accept Invitation"
              )}
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground"
              disabled={respondToInvitationMut.isPending || emailMismatch}
              onClick={() => {
                setChoice(false);
                respondToInvitationMut.mutate({
                  path: {
                    invitationToken,
                  },
                  query: {
                    accepted: false,
                  },
                });
              }}
            >
              {respondToInvitationMut.isPending && !choice ? (
                <>
                  <Spinner />
                  Declining…
                </>
              ) : (
                "Decline"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
