import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconDots,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { ProjectColumnDetails, ProjectDetails } from "@/api";
import {
  deleteProjectColumnMutation,
  getProjectQueryKey,
  updateProjectColumnMutation,
} from "@/api/@tanstack/react-query.gen";
import { requestColumnCreate } from "../../column-dialog";
import { columnScoreBetween } from "../../use-drag-n-drop";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  column: ProjectColumnDetails;
  projectId: number;
};

export function ProjectColumnMenu({ column, projectId }: Props) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editName, setEditName] = useState(column.name);
  const [editColor, setEditColor] = useState(column.color);

  const queryKey = getProjectQueryKey({ path: { projectId } });

  const updateColumn = useMutation({
    ...updateProjectColumnMutation(),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, (old: ProjectDetails): ProjectDetails => ({
        ...old,
        columns: old.columns.map((c) =>
          Number(c.id) === Number(column.id)
            ? { ...c, name: updated.name, color: updated.color }
            : c,
        ),
      }));
      toast.success("Column updated");
      setEditOpen(false);
    },
    onError: () => toast.error("Failed to update column"),
  });

  const deleteColumn = useMutation({
    ...deleteProjectColumnMutation(),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, (old: ProjectDetails): ProjectDetails => ({
        ...old,
        columns: old.columns.filter((c) => Number(c.id) !== Number(column.id)),
      }));
      toast.success("Column deleted");
      setDeleteOpen(false);
    },
    onError: () => toast.error("Failed to delete column"),
  });

  const handleEditOpen = () => {
    setEditName(column.name);
    setEditColor(column.color);
    setEditOpen(true);
  };

  // Compute a score that inserts a new column just before/after this one, using
  // the current (score-ordered) neighbours from the cache.
  const handleAddColumn = (side: "before" | "after") => {
    const project = queryClient.getQueryData<ProjectDetails>(queryKey);
    const ordered = [...(project?.columns ?? [])].sort(
      (a, b) => Number(a.score) - Number(b.score),
    );
    const idx = ordered.findIndex((c) => Number(c.id) === Number(column.id));
    const self = Number(column.score);
    const neighbor =
      side === "before"
        ? idx > 0
          ? Number(ordered[idx - 1].score)
          : undefined
        : idx >= 0 && idx < ordered.length - 1
          ? Number(ordered[idx + 1].score)
          : undefined;

    const score =
      side === "before"
        ? columnScoreBetween(neighbor, self)
        : columnScoreBetween(self, neighbor);

    requestColumnCreate(score);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0 text-muted-foreground"
          >
            <IconDots className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconColumnInsertRight className="size-4" />
              Add column
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => handleAddColumn("before")}>
                <IconColumnInsertLeft className="size-4" />
                Before this
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleAddColumn("after")}>
                <IconColumnInsertRight className="size-4" />
                After this
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem onSelect={handleEditOpen}>
            <IconEdit className="size-4" />
            Edit column
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
            onSelect={() => setDeleteOpen(true)}
          >
            <IconTrash className="size-4" />
            Delete column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit column</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="col-name">Name</Label>
              <Input
                id="col-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="col-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="col-color"
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-input p-0.5"
                />
                <Input
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  maxLength={9}
                  className="font-mono uppercase"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!editName.trim() || updateColumn.isPending}
              onClick={() =>
                updateColumn.mutate({
                  body: { name: editName.trim(), color: editColor },
                  path: { projectId, columnId: Number(column.id) },
                })
              }
            >
              {updateColumn.isPending && <Spinner className="size-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{column.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the column
              {column.tasks.length > 0
                ? ` and all ${column.tasks.length} task${column.tasks.length === 1 ? "" : "s"} inside it`
                : ""}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteColumn.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteColumn.isPending}
              onClick={() =>
                deleteColumn.mutate({
                  path: { projectId, columnId: Number(column.id) },
                })
              }
            >
              {deleteColumn.isPending && <Spinner className="size-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
