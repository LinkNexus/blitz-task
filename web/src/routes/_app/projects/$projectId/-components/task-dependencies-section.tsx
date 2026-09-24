import { IconLink, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { ProjectDetails, ProjectTaskDetails } from "@/api";
import {
  addTaskDependencyMutation,
  getProjectQueryKey,
  removeTaskDependencyMutation,
} from "@/api/@tanstack/react-query.gen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isCompletedColumn } from "./task-dependencies";

type Props = {
  project: ProjectDetails;
  task: ProjectTaskDetails;
};

/**
 * "Blocked by" and "Blocks", edited in place.
 *
 * Applied immediately rather than carried in the form, like ticking a checklist item: an edge
 * joins two rows, so both ends have to exist before it can be written — there is nothing
 * coherent to hold in the form of a task that has not been saved yet. The sheet only renders
 * this in edit mode for the same reason.
 */
export function TaskDependenciesSection({ project, task }: Props) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const projectId = Number(project.id);
  const taskId = Number(task.id);
  const queryKey = getProjectQueryKey({ path: { projectId } });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const addDependency = useMutation({
    ...addTaskDependencyMutation(),
    onSuccess: () => {
      setAdding(false);
      refresh();
    },
    // The server refuses loops and self-blocks; it phrases them, so show what it said.
    onError: (error) =>
      toast.error(
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Could not add that blocker",
      ),
  });

  const removeDependency = useMutation({
    ...removeTaskDependencyMutation(),
    onSuccess: refresh,
    onError: () => toast.error("Could not remove that blocker"),
  });

  const blockedByIds = new Set(task.blockedBy.map((b) => String(b.id)));

  // Everything else on the board. The server rejects a loop anyway, but offering a task that is
  // already a blocker — or this one — is offering a choice that can only fail.
  const candidates = project.columns
    .flatMap((column) => column.tasks)
    .filter(
      (candidate) =>
        String(candidate.id) !== String(task.id) &&
        !blockedByIds.has(String(candidate.id)),
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <IconLink className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Dependencies</span>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Blocked by</p>

        {task.blockedBy.length === 0 && (
          <p className="text-xs text-muted-foreground/60">
            Nothing is holding this up.
          </p>
        )}

        {task.blockedBy.map((blocker) => {
          const done = isCompletedColumn(blocker.columnId, project);
          return (
            <div
              key={String(blocker.id)}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5"
            >
              <Badge
                variant={done ? "secondary" : "outline"}
                className={cn(
                  "rounded-md text-[10px] shrink-0",
                  !done &&
                    "border-amber-500/50 text-amber-600 dark:text-amber-400",
                )}
              >
                {done ? "Done" : "Open"}
              </Badge>
              <span
                className={cn(
                  "flex-1 truncate text-sm",
                  done && "text-muted-foreground line-through",
                )}
              >
                {blocker.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="size-6 shrink-0 p-0"
                aria-label={`Remove ${blocker.name} as a blocker`}
                onClick={() =>
                  removeDependency.mutate({
                    path: {
                      projectId,
                      taskId,
                      dependsOnTaskId: Number(blocker.id),
                    },
                  })
                }
              >
                <IconX className="size-3.5" />
              </Button>
            </div>
          );
        })}

        {adding ? (
          <Select
            onValueChange={(value) =>
              addDependency.mutate({
                path: { projectId, taskId },
                body: { dependsOnTaskId: Number(value) },
              })
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Which task blocks this one?" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((candidate) => (
                <SelectItem
                  key={String(candidate.id)}
                  value={String(candidate.id)}
                >
                  {candidate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={candidates.length === 0}
            onClick={() => setAdding(true)}
          >
            <IconPlus className="size-3.5" />
            Add a blocker
          </Button>
        )}
      </div>

      {/* The other direction is read-only: it is edited from the task that is blocked, which is
          where someone decides the dependency exists. */}
      {task.blocks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Blocks</p>
          {task.blocks.map((dependent) => (
            <div
              key={String(dependent.id)}
              className="rounded-md border px-2 py-1.5 text-sm truncate"
            >
              {dependent.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
