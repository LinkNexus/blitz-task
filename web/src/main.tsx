import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, Navigate, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./components/theme-provider";
// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import "./index.css";
import { client } from "./api/client.gen";
import { isWrite } from "./hooks/use-offline";
import { ensureCsrfToken } from "./lib/csrf";
import { getCookie } from "./lib/utils";

await ensureCsrfToken();

client.interceptors.request.use(async (request) => {
  // Refused here rather than left to time out. With no network a write cannot succeed, and the
  // difference between "failed" and "will save later" is one the app has no way to honour: the
  // service worker could queue the request, but the promise still rejects, so the user would be
  // told it failed and then have it silently go through minutes later. Failing immediately with
  // a sentence that names the cause is the honest version — see ROADMAP L45 for what queuing
  // them properly would take.
  if (
    typeof navigator !== "undefined" &&
    !navigator.onLine &&
    isWrite(request.method)
  ) {
    throw new Error("You're offline — this change can't be saved right now.");
  }

  // The boot-time fetch is allowed to fail (see `ensureCsrfToken`), so a session that started
  // offline reaches its first write with no token. Fetching it here is what makes coming back
  // online need no reload.
  if (isWrite(request.method)) await ensureCsrfToken();

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
      // React Query's default is `networkMode: "online"`, which refuses to *run* anything while
      // `navigator.onLine` is false — and that silently disables both halves of L45's offline
      // support. A query never fires, so the service worker is never asked and the cached read
      // it is holding is never served: a cold load offline sits on its suspense boundary
      // forever. Letting the request through is what makes the cache reachable; a genuinely
      // uncachable read still fails, which is the honest answer.
      networkMode: "always",
      // React Query's default `staleTime: 0` means every mount refetches, so each navigation
      // back to a page re-requests everything it reads — cached data renders instantly, but the
      // network traffic is the same as a cold load. Half a minute of trust is safe here because
      // every mutation invalidates what it touched (see lib/query-invalidation.ts); the window
      // only ever hides a *collaborator's* change, and only until the next refocus.
      staleTime: 30_000,
    },
    mutations: {
      // Same reason, opposite direction. The default *pauses* a mutation while offline and
      // replays it on reconnect — which sounds like the queued writes L45 wanted and is not:
      // the button spins with no explanation for as long as the connection is gone, and the
      // write then lands minutes later against a board that has moved on. `/move` carries a
      // client-computed score, so a replayed drop is wrong by construction. Run it, let the
      // request interceptor above refuse it immediately, and say so.
      networkMode: "always",
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
