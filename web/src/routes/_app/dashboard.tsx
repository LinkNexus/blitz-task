import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_authenticated/dashboard"!</div>;
}
