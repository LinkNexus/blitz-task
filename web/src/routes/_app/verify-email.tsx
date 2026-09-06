import { IconMailCheck } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { getCurrentUserQueryKey } from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAccount } from "@/hooks/use-current-user";
import { EmailVerificationBanner } from "./-components/email-verification-banner";

export const Route = createFileRoute("/_app/verify-email")({
  beforeLoad({ context }) {
    // The other half of the `_app` guard that sends unconfirmed users here: a confirmed user
    // who kept this URL around — or who confirmed in the tab their email link opened and came
    // back to this one — should not sit on a page telling them to do what they already did.
    if (context.user?.emailConfirmed) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { user } = useAccount();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  // The confirmation link is opened in whatever browser the mail client hands it to, so this
  // tab can be looking at a stale answer indefinitely: the root route reads getCurrentUser once
  // with `staleTime: Infinity` and nothing re-reads the flag on its own. Invalidate it, then
  // re-run the route guards — `beforeLoad` above is what actually lets the user back in.
  const recheck = async () => {
    setChecking(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: getCurrentUserQueryKey(),
      });
      await router.invalidate();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Confirm your email
        </h1>
        <p className="text-sm text-muted-foreground">
          Your projects and tasks unlock as soon as {user.email} is verified.
        </p>
      </header>

      <EmailVerificationBanner />

      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <IconMailCheck className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Already clicked the link?</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          If you confirmed in another browser or tab, this one is still holding
          the old answer.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={recheck}
          disabled={checking}
        >
          {checking && <Spinner />}
          Check again
        </Button>
      </Card>
    </div>
  );
}
