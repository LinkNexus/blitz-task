import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ProjectColumnDetails, ProjectDetails } from "@/api";
import {
  createProjectColumnMutation,
  getProjectQueryKey,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  project: ProjectDetails;
};

/** Detail carried by the `column.create` CustomEvent. */
export type ColumnCreateDetail = {
  /** Score that positions the new column (computed by the trigger). */
  score: number;
};

/** Opens the create-column dialog, positioning the new column at `score`. */
export function requestColumnCreate(score: number) {
  document.dispatchEvent(
    new CustomEvent<ColumnCreateDetail>("column.create", {
      detail: { score },
    }),
  );
}

const DEFAULT_COLOR = "#6366f1";

export function ColumnDialog({ project }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [score, setScore] = useState(1000);

  const queryKey = getProjectQueryKey({
    path: { projectId: Number(project.id) },
  });

  useEffect(() => {
    const onCreate = (e: Event) => {
      const detail = (e as CustomEvent<ColumnCreateDetail>).detail;
      setName("");
      setColor(DEFAULT_COLOR);
      setScore(detail?.score ?? 1000);
      setOpen(true);
    };
    document.addEventListener("column.create", onCreate);
    return () => document.removeEventListener("column.create", onCreate);
  }, []);

  const createColumn = useMutation({
    ...createProjectColumnMutation(),
    onSuccess: (created: ProjectColumnDetails) => {
      queryClient.setQueryData(
        queryKey,
        (old: ProjectDetails): ProjectDetails => ({
          ...old,
          columns: [...old.columns, created],
        }),
      );
      toast.success("Column created");
      setOpen(false);
    },
    onError: () => toast.error("Failed to create column"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New column</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-col-name">Name</Label>
            <Input
              id="new-col-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Column name"
              maxLength={100}
              autoFocus
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  name.trim() &&
                  !createColumn.isPending
                ) {
                  createColumn.mutate({
                    body: { name: name.trim(), color, score },
                    path: { projectId: Number(project.id) },
                  });
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-col-color">Color</Label>
            <div className="flex items-center gap-2">
              <input
                id="new-col-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border border-input p-0.5"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                maxLength={9}
                className="font-mono uppercase"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || createColumn.isPending}
            onClick={() =>
              createColumn.mutate({
                body: { name: name.trim(), color, score },
                path: { projectId: Number(project.id) },
              })
            }
          >
            {createColumn.isPending && <Spinner className="size-4" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
