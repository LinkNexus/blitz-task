import { IconInbox, IconPlus } from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  getInboxOptions,
  listProjectsOptions,
  listUserTasksOptions,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InboxRow } from "./-components/inbox-row";
import { requestQuickCapture } from "./-components/quick-capture";
import { TaskListSkeleton } from "./-components/task-list-skeleton";

/** Captures are read through the same cross-project endpoint as every other list, scoped to the
 *  Inbox project — one query shape for every task list in the app. */
const inboxTasksQueryOptions = (projectId: number) =>
  listUserTasksOptions({ query: { projectId, limit: 200 } });

export const Route = createFileRoute("/_app/inbox")({
  loader: async ({ context }) => {
    // Sequential on purpose: the Inbox is created by this request the first time it is asked
    // for, and its id is what the task query is scoped to.
    const inbox = await context.queryClient.ensureQueryData(getInboxOptions());
    await Promise.all([
      context.queryClient.ensureQueryData(
        inboxTasksQueryOptions(Number(inbox.projectId)),
      ),
      context.queryClient.ensureQueryData(listProjectsOptions()),
    ]);
  },
  pendingComponent: TaskListSkeleton,
  component: InboxPage,
});

function InboxPage() {
  const { data: inbox } = useSuspenseQuery(getInboxOptions());
  const { data: tasks } = useSuspenseQuery(
    inboxTasksQueryOptions(Number(inbox.projectId)),
  );
  const { data: projects } = useSuspenseQuery(listProjectsOptions());

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Everything captured but not yet filed into a project.
          </p>
        </div>
        <Button size="sm" onClick={requestQuickCapture}>
          <IconPlus className="size-4" />
          Capture
        </Button>
      </header>

      {tasks.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <IconInbox className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Your Inbox is empty</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Press <kbd className="rounded border bg-muted px-1">c</kbd> anywhere
            to write something down without deciding where it belongs.
          </p>
        </Card>
      ) : (
        <div className="space-y-0.5">
          {tasks.map((task) => (
            <InboxRow key={String(task.id)} task={task} projects={projects} />
          ))}
        </div>
      )}
    </div>
  );
}
