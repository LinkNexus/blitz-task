import { IconPlus } from "@tabler/icons-react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { type ApiMessageResponse, resendConfirmEmail } from "@/api";
import { client } from "@/api/client.gen";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { flashMessagesStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { QuickCapture, requestQuickCapture } from "./-components/quick-capture";
import { AppSidebar } from "./-components/sidebar/app-sidebar";

const authErrorsInterceptor = async (
  error: unknown,
  response: Response | undefined,
) => {
  if (!response) return;

  switch (response.status) {
    case 401:
      throw redirect({
        to: "/login",
      });

    case 403: {
      let message =
        "You don't have permission to perform this action, because your email address is not verified";

      if (response) {
        const err = error as ApiMessageResponse & { type?: string };
        if ("type" in err && err.type === "Authorization")
          message = err.message;
        else return error;
      }

      flashMessagesStore.actions.addSingle({
        type: "error",
        message: {
          title: "Forbidden Access",
          description: message,
          action: {
            label: "Verify",
            onClick: async () => {
              const { data } = await resendConfirmEmail();
              if (data) {
                toast.success("Email confirmed", {
                  description: data.message,
                });
              }
            },
          },
        },
      });

      // Flash the toast *and* hand the error back. Returning null used to swallow it, but the
      // client coerces a falsy interceptor result to `{}` and — every generated query sets
      // `throwOnError` — throws that instead: a loader rejecting with a message-less empty
      // object, which surfaces as a blank error screen with the real cause nowhere in sight.
      return error;
    }
  }

  return error;
};

export const Route = createFileRoute("/_app")({
  component: RouteComponent,
  beforeLoad({ context, location }) {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    // Every endpoint under this layout is gated by the backend's "EmailConfirmed" policy, so a
    // freshly registered account cannot load a single route here: /dashboard's loader 403s
    // before the page ever renders, and the failure reads as a crash rather than as "confirm
    // your email". Send unconfirmed users to the one page that works instead — a banner over a
    // route that cannot load its own data is not a state worth rendering.
    if (!context.user.emailConfirmed && location.pathname !== "/verify-email") {
      throw redirect({ to: "/verify-email" });
    }

    if (!client.interceptors.error.exists(authErrorsInterceptor)) {
      client.interceptors.error.use(authErrorsInterceptor);
    }
  },
});

function RouteComponent() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={(open) => {
        setSidebarOpen(open);
      }}
      className="max-w-screen"
    >
      <AppSidebar />
      <SidebarInset
        className={cn(
          "w-full",
          sidebarOpen
            ? "md:max-w-[calc(100%-var(--sidebar-width))]"
            : "md:max-w-[calc(100%-var(--sidebar-width-icon))]",
        )}
      >
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
          <div className="ml-auto px-4">
            <Button variant="outline" size="sm" onClick={requestQuickCapture}>
              <IconPlus className="size-4" />
              Capture
              <kbd className="ml-1 hidden rounded border bg-muted px-1 text-[10px] font-medium text-muted-foreground sm:inline">
                c
              </kbd>
            </Button>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-screen">
            <div className="max-w-4xl mx-auto py-8 px-4">
              <Outlet />
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Mounted in the layout, not per route: capture has to be reachable from anywhere, and
          the dialog owns its own open state via a document event. */}
      <QuickCapture />
    </SidebarProvider>
  );
}
