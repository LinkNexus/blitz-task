import {
  IconArrowBackUp,
  IconFolder,
  IconTrash,
  IconTrashOff,
} from "@tabler/icons-react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import type { TrashItem } from "@/api";
import {
  listTrashOptions,
  listTrashQueryKey,
  purgeProjectMutation,
  purgeTaskMutation,
  restoreProjectMutation,
  restoreTaskMutation,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  invalidateProjectBoards,
  invalidateProjectLists,
} from "@/lib/query-invalidation";

export const Route = createFileRoute("/_app/trash")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(listTrashOptions()),
  pendingComponent: TrashSkeleton,
  component: TrashPage,
});

function TrashSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Whole days left, floored — "0 days left" would read as a bug on the last afternoon. */
function daysLeft(purgeAt: string): number {
  const ms = new Date(purgeAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function TrashPage() {
  const queryClient = useQueryClient();
  const { data: items } = useSuspenseQuery(listTrashOptions());
  const [pendingPurge, setPendingPurge] = useState<TrashItem | null>(null);

  // The trash changes what projects exist and which tasks are open, and both of those are read
  // by screens that are not this one — the sidebar in particular never unmounts, so a restored
  // project stays missing from it until a full reload.
  const refreshEverything = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: listTrashQueryKey() }),
      invalidateProjectLists(queryClient),
      invalidateProjectBoards(queryClient),
    ]);

  const restoreProject = useMutation({
    ...restoreProjectMutation(),
    onSuccess: async () => {
      await refreshEverything();
      toast.success("Project restored");
    },
  });

  const restoreTask = useMutation({
    ...restoreTaskMutation(),
    onSuccess: async () => {
      await refreshEverything();
      toast.success("Task restored");
    },
    // A task whose project is also in the trash is refused with a reason worth reading, so this
    // one message beats a generic failure toast.
    onError: (error) =>
      toast.error(
        (error as { message?: string })?.message ??
          "Could not restore that task",
      ),
  });

  const purgeProject = useMutation({
    ...purgeProjectMutation(),
    onSuccess: async () => {
      await refreshEverything();
      toast.success("Deleted permanently");
    },
  });

  const purgeTask = useMutation({
    ...purgeTaskMutation(),
    onSuccess: async () => {
      await refreshEverything();
      toast.success("Deleted permanently");
    },
  });

  const restore = (item: TrashItem) =>
    item.kind === "PROJECT"
      ? restoreProject.mutate({ path: { projectId: Number(item.id) } })
      : restoreTask.mutate({ path: { taskId: Number(item.id) } });

  const purge = (item: TrashItem) => {
    setPendingPurge(null);
    if (item.kind === "PROJECT") {
      purgeProject.mutate({ path: { projectId: Number(item.id) } });
    } else {
      purgeTask.mutate({ path: { taskId: Number(item.id) } });
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
        <p className="text-sm text-muted-foreground">
          Deleted items are kept for 30 days, then removed for good.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16">
          <IconTrashOff className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Nothing in the trash</p>
          <p className="text-sm text-muted-foreground">
            Deleted projects and tasks will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const left = daysLeft(item.purgeAt);
            return (
              <div
                key={`${item.kind}-${item.id}`}
                className="flex items-center gap-3 rounded-xl border px-4 py-3"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {item.kind === "PROJECT" ? (
                    <IconFolder className="size-4" />
                  ) : (
                    <IconTrash className="size-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {item.name}
                    </span>
                    {item.kind === "PROJECT" && Number(item.taskCount) > 0 && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {item.taskCount} task
                        {Number(item.taskCount) === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.kind === "TASK" && <>in {item.projectName} · </>}
                    deleted{" "}
                    {new Date(item.deletedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {" · "}
                    {left} day{left === 1 ? "" : "s"} left
                  </p>
                </div>

                {item.canRestore ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => restore(item)}
                    >
                      <IconArrowBackUp className="size-3.5" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingPurge(item)}
                      aria-label={`Delete ${item.name} permanently`}
                    >
                      <IconTrash className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  // Seeing a row is not the same as being allowed to act on it: the trash shows
                  // everything deleted in projects you are in, so an Owner can undo someone
                  // else's mistake, but the role rules still decide who may.
                  <span className="shrink-0 text-xs text-muted-foreground">
                    No permission
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={pendingPurge !== null}
        onOpenChange={(open) => !open && setPendingPurge(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPurge?.name} and its attachments will be removed for good.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingPurge && purge(pendingPurge)}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
