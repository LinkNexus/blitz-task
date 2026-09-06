import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, Navigate, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./components/theme-provider";
// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import "./index.css";
import { client } from "./api/client.gen";
import { getCookie } from "./lib/utils";

await fetch("/api/csrf-token");

client.interceptors.request.use(async (request) => {
  const headers = new Headers(request.headers);
  headers.set("X-XSRF-TOKEN", getCookie("XSRF-TOKEN") ?? "");

  return new Request(request, {
    credentials: "include",
    headers,
  });
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      // React Query's default `staleTime: 0` means every mount refetches, so each navigation
      // back to a page re-requests everything it reads — cached data renders instantly, but the
      // network traffic is the same as a cold load. Half a minute of trust is safe here because
      // every mutation invalidates what it touched (see lib/query-invalidation.ts); the window
      // only ever hides a *collaborator's* change, and only until the next refocus.
      staleTime: 30_000,
    },
  },
});

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  // The server answers every unknown path with 200 + index.html — it cannot know which paths
  // the router owns — so a bad URL gets all the way here and then matches nothing. A dead end
  // is the worst outcome in a task app; send it somewhere it can act instead. `replace` keeps
  // the bad URL out of history, so Back doesn't bounce straight into it again. Unauthenticated
  // visitors are handed on to /login by the `_app` route's own beforeLoad.
  defaultNotFoundComponent: () => <Navigate to="/dashboard" replace />,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
