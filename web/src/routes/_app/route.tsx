import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { client } from "@/api/client.gen";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAccount } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import { EmailVerificationBanner } from "./-components/email-verification-banner";
import { AppSidebar } from "./-components/sidebar/app-sidebar";

const authErrorsInterceptor = (
  error: unknown,
  response: Response | undefined,
) => {
  if (!response) return;

  switch (response.status) {
    case 401:
      throw redirect({
        to: "/login",
      });

    case 403:
      toast.error("Email not verified", {
        description:
          "You don't have permission to perform this action, because your email address is not verified",
        action: (
          <Button
            onClick={async () => {
              console.log("hello");
            }}
          >
            Verify
          </Button>
        ),
      });
      return null;
  }

  return error;
};

export const Route = createFileRoute("/_app")({
  component: RouteComponent,
  beforeLoad({ context, location }) {
    console.log(context.user);
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
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
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
