import {
  IconArrowRight,
  IconDots,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { ProjectDetails, ProjectTaskDetails } from "@/api";
import {
  deleteProjectTaskMutation,
  getProjectQueryKey,
} from "@/api/@tanstack/react-query.gen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { invalidateUserTasks } from "@/lib/query-invalidation";
import { scoreAtTopOf } from "../../use-drag-n-drop";
import { useMoveTask } from "../../use-move-task";

type Props = {
  task: ProjectTaskDetails;
  project: ProjectDetails;
};

export function ProjectMenu({ task, project }: Props) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const projectId = Number(project.id);
  const queryKey = getProjectQueryKey({ path: { projectId } });
  const { moveTask } = useMoveTask(project);

  const deleteTask = useMutation({
    ...deleteProjectTaskMutation(),
    onSuccess: () => {
      queryClient.setQueryData(
        queryKey,
        (old: ProjectDetails): ProjectDetails => ({
          ...old,
          columns: old.columns.map((c) => ({
            ...c,
            tasks: c.tasks.filter((t) => Number(t.id) !== Number(task.id)),
          })),
        }),
      );
      // Gone from the board, and from the dashboard's open-task list with it.
      invalidateUserTasks(queryClient);
      toast.success("Moved to trash");
      setConfirmOpen(false);
    },
    onError: () => toast.error("Failed to delete task"),
  });

  const otherColumns = project.columns.filter(
    (c) => Number(c.id) !== Number(task.columnId),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <IconDots className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={() =>
            document.dispatchEvent(
              new CustomEvent("task.update", { detail: task }),
            )
          }
        >
          <IconEdit className="size-4" />
          Edit task
        </DropdownMenuItem>

        {/* Not just a convenience: dragging is disabled while a manual sort is active, and
            the table view's non-column groupings have no dnd at all, so this is the only way
            to move a task from either of those. It lands on top of the target column —
            there are no neighbours to drop between when you cannot see where it goes. */}
        {otherColumns.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconArrowRight className="size-4" />
              Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {otherColumns.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() =>
                    moveTask(task, Number(c.id), scoreAtTopOf(c), {
                      onSuccess: () => toast.success(`Moved to ${c.name}`),
                      onError: () => toast.error("Failed to move task"),
                    })
                  }
                >
                  <div
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmOpen(true);
          }}
        >
          <IconTrash className="size-4" />
          Delete task
        </DropdownMenuItem>
      </DropdownMenuContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Move this task to the trash?</AlertDialogTitle>
            <AlertDialogDescription>
              "{task.name}" will be kept in the trash for 30 days, and you can
              restore it from there until then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTask.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteTask.isPending}
              onClick={() =>
                deleteTask.mutate({
                  path: { projectId, taskId: Number(task.id) },
                })
              }
            >
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DropdownMenu>
  );
}
