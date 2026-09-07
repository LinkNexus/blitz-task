import { IconCalendarDue, IconFolderShare } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ProjectSummary, UserTaskSummary } from "@/api";
import { fileUserTaskMutation } from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { invalidateProjectLists } from "@/lib/query-invalidation";
import { cn } from "@/lib/utils";
import {
  getPriorityIcon,
  getPriorityPillClass,
} from "@/routes/_app/projects/$projectId/-components/kanban-view/lib";

/**
 * A capture, with the one action that matters in an Inbox: getting it out of the Inbox.
 *
 * Not `TaskRow`, which is a link to a board — an Inbox row is a working surface, and the Inbox
 * board is not somewhere the user should be sent to manage columns and members.
 */
export function InboxRow({
  task,
  projects,
}: {
  task: UserTaskSummary;
  projects: ProjectSummary[];
}) {
  const queryClient = useQueryClient();

  const file = useMutation({
    ...fileUserTaskMutation(),
    onSuccess: (filed) => {
      // Both lists move: the task leaves the Inbox and joins a project, and the project's own
      // board — cached separately — now has a task it has never seen.
      invalidateProjectLists(queryClient);
      toast.success(`Filed into ${filed.projectName}`);
    },
    onError: () => toast.error("Failed to file the task"),
  });

  return (
    <div className="flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.name}</p>
        {task.dueDate && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <IconCalendarDue className="size-3.5 shrink-0" />
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </div>
        )}
      </div>

      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
          getPriorityPillClass(task.priority),
        )}
      >
        {getPriorityIcon(task.priority)}
        {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={file.isPending || projects.length === 0}
            title={
              projects.length === 0
                ? "Create a project first"
                : "File into a project"
            }
          >
            <IconFolderShare className="size-4" />
            File
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>File into</DropdownMenuLabel>
          {projects.map((project) => (
            <DropdownMenuItem
              key={String(project.id)}
              onSelect={() =>
                file.mutate({
                  path: { taskId: Number(task.id) },
                  // No column: the server drops it in the target's first one, which is what
                  // "I have not decided where this goes yet" means.
                  body: { projectId: Number(project.id), columnId: null },
                })
              }
            >
              {project.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
