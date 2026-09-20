import {
  IconArrowLeft,
  IconCalendar,
  IconFlag,
  IconPencil,
} from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ProjectTaskDetails } from "@/api";
import {
  getProjectOptions,
  getUserTaskOptions,
} from "@/api/@tanstack/react-query.gen";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils";
import { TaskComments } from "../projects/$projectId/-components/task-comments";
import { TaskSheet } from "../projects/$projectId/-components/task-sheet";

export const Route = createFileRoute("/_app/tasks/$taskId")({
  loader: async ({ context, params }) => {
    // Two requests, deliberately sequential: the URL carries no project id — that is the whole
    // point of the route, since filing a task moves it between projects — so the first call is
    // what says which project to load.
    const task = await context.queryClient.ensureQueryData(
      getUserTaskOptions({ path: { taskId: Number(params.taskId) } }),
    );

    await context.queryClient.ensureQueryData(
      getProjectOptions({ path: { projectId: Number(task.projectId) } }),
    );
  },
  pendingComponent: TaskSkeleton,
  errorComponent: TaskNotFound,
  component: TaskPage,
});

/**
 * Where a stale link lands.
 *
 * These URLs outlive what they point at — they are pasted into notifications and messages, and
 * the thing on the other end can be deleted, purged, or in a project you have since been
 * removed from. The API answers all three with **not found** on purpose, so that a stranger
 * cannot tell "no such task" from "not yours", and this says the same thing rather than leaking
 * the difference back through the UI.
 */
function TaskNotFound() {
  return (
    <div className="space-y-3 py-12 text-center">
      <h1 className="text-lg font-semibold">This task isn’t available</h1>
      <p className="text-sm text-muted-foreground">
        It may have been deleted, or it might live in a project you no longer
        have access to.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}

function TaskSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

const PRIORITY_TONE: Record<string, string> = {
  URGENT: "bg-destructive/10 text-destructive",
  HIGH: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  MEDIUM: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
  LOW: "bg-muted text-muted-foreground",
};

function TaskPage() {
  const { taskId } = Route.useParams();
  const id = Number(taskId);

  const { data: summary } = useSuspenseQuery(
    getUserTaskOptions({ path: { taskId: id } }),
  );
  const { data: project } = useSuspenseQuery(
    getProjectOptions({ path: { projectId: Number(summary.projectId) } }),
  );

  // The project carries the full task — checklist, attachments, recurrence — so the page shows
  // detail the cross-project summary does not have without a second projection existing.
  const task: ProjectTaskDetails | undefined = project.columns
    .flatMap((column) => column.tasks)
    .find((candidate) => Number(candidate.id) === id);

  const column = project.columns.find(
    (c) => Number(c.id) === Number(task?.columnId),
  );

  const assignees = project.participants.filter((p) =>
    task?.assigneeIds.some(
      (assigneeId) => Number(assigneeId) === Number(p.userId),
    ),
  );

  const done = task?.checklistItems.filter((item) => item.isDone).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Where this task lives, and the way back to it. An Inbox capture points at /inbox:
          its board is hidden on purpose. */}
      {summary.isInbox ? (
        <Link
          to="/inbox"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="size-4" />
          Inbox
        </Link>
      ) : (
        <Link
          to="/projects/$projectId"
          params={{ projectId: String(summary.projectId) }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="size-4" />
          {summary.projectName}
        </Link>
      )}

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {summary.name}
        </h1>

        {/* Editing is the sheet, opened by the same event the board uses. A second editor here
            would drift from it within a release — reminders, checklists and recurrence all
            live in that form. */}
        {task && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent("task.update", { detail: task }),
              )
            }
          >
            <IconPencil className="size-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {column && (
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: column.color }}
            />
            {column.name}
          </span>
        )}

        <Badge className={PRIORITY_TONE[summary.priority] ?? PRIORITY_TONE.LOW}>
          <IconFlag className="size-3" />
          {summary.priority.charAt(0) + summary.priority.slice(1).toLowerCase()}
        </Badge>

        {summary.dueDate && (
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-muted-foreground">
            <IconCalendar className="size-3.5" />
            {format(new Date(summary.dueDate), "d MMM yyyy")}
          </span>
        )}

        {!!assignees.length && (
          <span className="flex items-center gap-1">
            {assignees.map((person) => (
              <Avatar key={String(person.userId)} className="size-6">
                <AvatarFallback className="text-[10px]">
                  {getInitials(person.name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </span>
        )}
      </div>

      {!!summary.tags.length && (
        <div className="flex flex-wrap gap-1.5">
          {summary.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {summary.description ? (
        <div className="markdown-preview prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {summary.description}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No description.</p>
      )}

      {!!task?.checklistItems.length && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            Checklist{" "}
            <span className="text-muted-foreground">
              {done}/{task.checklistItems.length}
            </span>
          </p>
          <ul className="space-y-1">
            {task.checklistItems.map((item) => (
              <li
                key={String(item.id)}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {item.isDone ? "☑" : "☐"}
                </span>
                <span
                  className={
                    item.isDone ? "text-muted-foreground line-through" : ""
                  }
                >
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <TaskComments project={project} taskId={id} />

      {/* Mounted here so the Edit button has something to open — the same component the board
          mounts, given the same project. */}
      <TaskSheet project={project} />
    </div>
  );
}
