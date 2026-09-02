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
