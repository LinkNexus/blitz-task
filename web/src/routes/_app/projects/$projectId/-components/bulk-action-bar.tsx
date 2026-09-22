import {
  IconArrowRight,
  IconTag,
  IconTrash,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { BulkTaskResult, ProjectDetails } from "@/api";
import {
  bulkAssignTasksMutation,
  bulkDeleteTasksMutation,
  bulkMoveTasksMutation,
  bulkTagTasksMutation,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { invalidateUserTasks } from "@/lib/query-invalidation";
import { useTaskSelection } from "./task-selection";

type Props = {
  project: ProjectDetails;
};

export function BulkActionBar({ project }: Props) {
  const queryClient = useQueryClient();
  const selection = useTaskSelection();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [newTag, setNewTag] = useState("");

  const projectId = Number(project.id);
  const taskIds = [...selection.selected];

  /**
   * The board is written by `setQueryData` everywhere else, but a bulk edit's response is a
   * count rather than the rows — so this refetches instead. `invalidateUserTasks` is the other
   * half: the dashboard reads the same tasks through a different key that no board write
   * touches, and would sit on a stale list for `staleTime`.
   */
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: getProjectQueryKey({ path: { projectId } }),
      }),
      invalidateUserTasks(queryClient),
    ]);

  const settle = async (result: BulkTaskResult, verb: string) => {
    await refresh();
    selection.clear();

    const affected = Number(result.affected);
    const skipped = Number(result.skipped);

    if (affected === 0 && skipped === 0) {
      toast.info("Nothing to change");
      return;
    }

    const changed = `${verb} ${affected} ${affected === 1 ? "task" : "tasks"}`;
    // Skipped is neither a failure nor a success — reporting only the count that changed would
    // leave someone wondering why three of their twelve tasks look untouched.
    toast.success(
      skipped > 0
        ? `${changed} — ${skipped} already had the maximum number of tags`
        : changed,
    );
  };

  const onError = () => toast.error("Could not apply that to every task");

  const moveTasks = useMutation({
    ...bulkMoveTasksMutation(),
    onSuccess: (result) => settle(result, "Moved"),
    onError,
  });

  const assignTasks = useMutation({
    ...bulkAssignTasksMutation(),
    onSuccess: (result) => settle(result, "Updated"),
    onError,
  });

  const tagTasks = useMutation({
    ...bulkTagTasksMutation(),
    onSuccess: (result) => settle(result, "Tagged"),
    onError,
  });

  const deleteTasks = useMutation({
    ...bulkDeleteTasksMutation(),
    onSuccess: (result) => {
      setConfirmingDelete(false);
      return settle(result, "Deleted");
    },
    onError,
  });

  const pending =
    moveTasks.isPending ||
    assignTasks.isPending ||
    tagTasks.isPending ||
    deleteTasks.isPending;

  if (selection.count === 0) return null;

  // Only the tags actually on the selection can be removed from it, so the menu offers exactly
  // those rather than every tag in the project.
  const tagsOnSelection = [
    ...new Set(
      project.columns
        .flatMap((column) => column.tasks)
        .filter((task) => selection.isSelected(task.id))
        .flatMap((task) => task.tags),
    ),
  ].sort();

  const addTag = (tag: string) => {
    const value = tag.trim();
    if (!value) return;
    setNewTag("");
    tagTasks.mutate({
      path: { projectId },
      body: { taskIds, tags: [value], mode: "Add" },
    });
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-40 flex w-fit max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full border bg-background/95 p-1.5 pl-3 shadow-lg backdrop-blur">
        <Badge variant="secondary" className="rounded-full shrink-0">
          {selection.count} selected
        </Badge>

        <Separator orientation="vertical" className="h-5 mx-1 shrink-0" />

        {/* Move */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs shrink-0"
              disabled={pending}
            >
              <IconArrowRight className="size-3.5" />
              Move to
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-44">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Move to column
            </DropdownMenuLabel>
            {[...project.columns]
              .sort((a, b) => Number(a.score) - Number(b.score))
              .map((column) => (
                <DropdownMenuItem
                  key={String(column.id)}
                  onClick={() =>
                    moveTasks.mutate({
                      path: { projectId },
                      body: { taskIds, columnId: Number(column.id) },
                    })
                  }
                >
                  {column.name}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Assign */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs shrink-0"
              disabled={pending}
            >
              <IconUserPlus className="size-3.5" />
              Assign
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Add to the selection
            </DropdownMenuLabel>
            {project.participants.map((participant) => (
              <DropdownMenuItem
                key={String(participant.userId)}
                onClick={() =>
                  assignTasks.mutate({
                    path: { projectId },
                    body: {
                      taskIds,
                      assigneeIds: [Number(participant.userId)],
                      mode: "Add",
                    },
                  })
                }
              >
                {participant.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                assignTasks.mutate({
                  path: { projectId },
                  body: { taskIds, assigneeIds: [], mode: "Replace" },
                })
              }
            >
              Clear assignees
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tag */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs shrink-0"
              disabled={pending}
            >
              <IconTag className="size-3.5" />
              Tag
            </Button>
          </PopoverTrigger>
          {/* A popover rather than a menu item: adding a tag needs a text field, and an input
              inside a dropdown fights the menu for focus on every keystroke. */}
          <PopoverContent align="center" className="w-60 space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Add a tag</p>
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTag(newTag);
                }}
                placeholder="release"
                maxLength={20}
                className="h-8 text-sm"
              />
            </div>

            {tagsOnSelection.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Remove a tag</p>
                <div className="flex flex-wrap gap-1.5">
                  {tagsOnSelection.map((tag) => (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 rounded-md px-1.5 text-[11px]"
                      onClick={() =>
                        tagTasks.mutate({
                          path: { projectId },
                          body: { taskIds, tags: [tag], mode: "Remove" },
                        })
                      }
                    >
                      {tag}
                      <IconX className="size-3 opacity-60" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive shrink-0"
          disabled={pending}
          onClick={() => setConfirmingDelete(true)}
        >
          <IconTrash className="size-3.5" />
          Delete
        </Button>

        <Separator orientation="vertical" className="h-5 mx-1 shrink-0" />

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={selection.clear}
          title="Clear selection"
        >
          <IconX className="size-3.5" />
        </Button>
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selection.count}{" "}
              {selection.count === 1 ? "task" : "tasks"}?
            </AlertDialogTitle>
            {/* Worth saying plainly: unlike the single-task delete, this is several at once, and
                the reassurance that it is recoverable is what makes confirming cheap. */}
            <AlertDialogDescription>
              They go to the trash and can be restored for 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteTasks.mutate({ path: { projectId }, body: { taskIds } });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
