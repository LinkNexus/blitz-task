import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { GetCurrentUserResponse } from "@/api";
import { getCurrentUserOptions } from "@/api/@tanstack/react-query.gen";
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

  // No `ThemeProvider` here: `main.tsx` already wraps `RouterProvider` in one, and having two
  // was not merely redundant. Each mounts its own `keydown` listener for the `d` shortcut and
  // each toggles *its own* state, so once the sidebar menu had called `setTheme` — which only
  // reaches the nearer provider — the two disagreed about the current theme and computed
  // different next values. Effects run child-first, so the stale outer one applied last and won:
  // set Light from the menu, press `d`, and the theme went the wrong way.
  return (
    <TooltipProvider>
      <Outlet />
      <Toaster />
    </TooltipProvider>
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
