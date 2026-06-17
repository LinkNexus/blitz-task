import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
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
const router = createRouter({ routeTree, context: { queryClient } });

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
