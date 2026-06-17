import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { GetCurrentUserResponse } from "@/api";
import { getCurrentUserOptions } from "@/api/@tanstack/react-query.gen";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { flashMessagesStore } from "@/lib/store";

function RootLayout() {
  const flashMessages = useSelector(flashMessagesStore, (state) => state);
  const shownMessages = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (flashMessages.length === 0) return;
    flashMessages
      .filter((m) => !shownMessages.current.has(m.id))
      .forEach((m) => {
        const { title, ...rest } = m.message;
        toast[m.type](title, rest);
        shownMessages.current.add(m.id);
      });
    flashMessagesStore.actions.clear();
  }, [flashMessages]);

  return (
    <ThemeProvider>
      <TooltipProvider>
        <Outlet />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  async beforeLoad({ context }) {
    let user: GetCurrentUserResponse | undefined;

    try {
      user = await context.queryClient.fetchQuery({
        ...getCurrentUserOptions(),
        staleTime: Infinity,
      });
    } catch (_error) {
      user = undefined;
    }

    return {
      user,
    };
  },
  component: RootLayout,
});
