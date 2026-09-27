import {
  IconDownload,
  IconFile,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import {
  listProjectAttachmentsOptions,
  listProjectAttachmentsQueryKey,
  removeProjectAttachmentMutation,
  uploadProjectAttachmentMutation,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** The download route, which authorises by asking whether the project can reach the file. */
export const projectFileUrl = (projectId: number, attachmentId: string) =>
  `/api/projects/${projectId}/attachments/${attachmentId}`;

export const formatSize = (bytes: number | string) =>
  `${(Number(bytes) / 1024).toFixed(0)} KB`;

/** Shared so the settings panel and the task picker cannot drift on how a key is spelled. */
export const projectFilesKey = (projectId: number) =>
  listProjectAttachmentsQueryKey({ path: { projectId } });

/**
 * The project's own files: uploaded once, referenced from any number of tasks.
 *
 * The reference count beside each row is the point of the screen rather than decoration — it is
 * what tells someone that removing a file is not going to strand three tasks. It can say so
 * confidently because removing here drops *the project's* reference only: a task holding the same
 * file keeps it, and the bytes survive until nothing at all points at them.
 */
export function ProjectFiles({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: files, isLoading } = useQuery(
    listProjectAttachmentsOptions({ path: { projectId } }),
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: projectFilesKey(projectId) });

  const upload = useMutation({
    ...uploadProjectAttachmentMutation(),
    onSuccess: () => {
      refresh();
      toast.success("File added to the project");
    },
    onError: (error) =>
      toast.error("message" in error ? error.message : "Upload failed"),
  });

  const remove = useMutation({
    ...removeProjectAttachmentMutation(),
    onSuccess: () => {
      refresh();
      toast.success("Removed from the project");
    },
    onError: () => toast.error("Couldn't remove that file"),
  });

  const onPick = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    upload.mutate({ path: { projectId }, body: { file } });
    // Cleared so picking the same file twice in a row still fires a change event.
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Project files</p>
          <p className="text-xs text-muted-foreground">
            Upload a spec or a design once, then reference it from any task.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? (
            <Spinner className="size-4" />
          ) : (
            <IconUpload className="size-3.5" />
          )}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-5" />
        </div>
      ) : files && files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={String(file.id)}
              className="flex items-center gap-3 rounded-lg border p-2.5"
            >
              <IconFile className="size-4 shrink-0 text-muted-foreground" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{file.originalFileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.sizeInBytes)}
                  {" · "}
                  {file.referencedByTaskCount === 0
                    ? "not used by any task"
                    : `used by ${file.referencedByTaskCount} task${file.referencedByTaskCount === 1 ? "" : "s"}`}
                </p>
              </div>

              <Button asChild size="icon" variant="ghost" className="size-8">
                <a
                  href={projectFileUrl(projectId, String(file.id))}
                  download={file.originalFileName}
                  title="Download"
                >
                  <IconDownload className="size-4" />
                </a>
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-destructive hover:text-destructive"
                disabled={remove.isPending}
                title="Remove from project"
                onClick={() =>
                  remove.mutate({
                    path: { projectId, attachmentId: String(file.id) },
                  })
                }
              >
                <IconTrash className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No project files yet.
        </p>
      )}
    </div>
  );
}
