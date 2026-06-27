import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { type ApiMessageResponse, resendConfirmEmail } from "@/api";
import { client } from "@/api/client.gen";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAccount } from "@/hooks/use-current-user";
import { flashMessagesStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EmailVerificationBanner } from "./-components/email-verification-banner";
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

      return null;
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

    if (!client.interceptors.error.exists(authErrorsInterceptor)) {
      client.interceptors.error.use(authErrorsInterceptor);
    }
  },
});

function RouteComponent() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAccount();

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
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-screen">
            <div className="max-w-4xl mx-auto py-8 px-4">
              {!user.emailConfirmed && <EmailVerificationBanner />}
              <Outlet />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
