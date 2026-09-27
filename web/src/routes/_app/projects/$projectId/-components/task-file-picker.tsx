import { IconFile, IconLink, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getProjectQueryKey,
  listProjectAttachmentsOptions,
  referenceTaskAttachmentMutation,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatSize, projectFilesKey } from "./project-files";

type Props = {
  projectId: number;
  taskId: number;
  /** Already on the task, so the menu can say so rather than offering it twice. */
  attachedIds: string[];
};

/**
 * Attaches a file the project already holds.
 *
 * Deliberately a separate control from the dropzone beside it, and it lands **immediately**
 * rather than on "Save changes" — for the same reason ticking a checklist item does. Referencing
 * is not an edit to the draft in the form; folding it into the task request would mean a sheet
 * opened before someone else referenced a file would silently un-reference it on save.
 *
 * Only shown while editing: a reference needs a task to hang off.
 */
export function TaskFilePicker({ projectId, taskId, attachedIds }: Props) {
  const queryClient = useQueryClient();

  const { data: files } = useQuery(
    listProjectAttachmentsOptions({ path: { projectId } }),
  );

  const reference = useMutation({
    ...referenceTaskAttachmentMutation(),
    onSuccess: () => {
      // The task's own attachment list comes from the project query, and the count in the files
      // panel just changed too.
      queryClient.invalidateQueries({
        queryKey: getProjectQueryKey({ path: { projectId } }),
      });
      queryClient.invalidateQueries({ queryKey: projectFilesKey(projectId) });
      toast.success("File attached");
    },
    onError: () => toast.error("Couldn't attach that file"),
  });

  const available = (files ?? []).filter(
    (file) => !attachedIds.includes(String(file.id)),
  );

  if (!files || files.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full justify-start gap-1.5 text-xs"
        >
          <IconLink className="size-3.5" />
          Attach a project file
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Project files
        </DropdownMenuLabel>

        {available.length === 0 ? (
          <p className="px-2 py-1.5 text-[11px] text-muted-foreground/70">
            Every project file is already on this task.
          </p>
        ) : (
          available.map((file) => (
            <DropdownMenuItem
              key={String(file.id)}
              className="gap-2"
              disabled={reference.isPending}
              onClick={() =>
                reference.mutate({
                  path: { projectId, taskId, attachmentId: String(file.id) },
                })
              }
            >
              <IconFile className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{file.originalFileName}</span>
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                {formatSize(file.sizeInBytes)}
              </span>
              <IconPlus className="size-3 shrink-0 opacity-50" />
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
