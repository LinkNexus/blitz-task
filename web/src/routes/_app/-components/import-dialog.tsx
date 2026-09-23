import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ExportEnvelope, ImportResult } from "@/api";
import { importExportFileMutation } from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { invalidateProjectLists } from "@/lib/query-invalidation";

/** Opens the import dialog. Matches how the task sheet and column dialog are summoned. */
export function requestImport() {
  document.dispatchEvent(new CustomEvent("data.import"));
}

/**
 * Everything the import did, in one sentence. Each skipped count is something the file asked for
 * that this instance could not give it, and saying so is the difference between a restore you can
 * trust and one that merely looks complete.
 */
function summarise(result: ImportResult): string {
  const parts: string[] = [];
  const projects = Number(result.projectsCreated);
  const tasks = Number(result.tasksImported);
  const inbox = Number(result.tasksIntoInbox);

  if (projects > 0) {
    parts.push(`${projects} ${projects === 1 ? "project" : "projects"}`);
  }
  if (tasks > 0) parts.push(`${tasks} ${tasks === 1 ? "task" : "tasks"}`);
  if (inbox > 0) parts.push(`${inbox} into your Inbox`);

  return parts.length > 0
    ? `Imported ${parts.join(", ")}`
    : "Nothing to import";
}

function skippedNote(result: ImportResult): string | undefined {
  const notes: string[] = [];
  const members = Number(result.membersSkipped);
  const comments = Number(result.commentsSkipped);
  const attachments = Number(result.attachmentsSkipped);

  if (members > 0) notes.push(`${members} with no account here`);
  if (comments > 0) notes.push(`${comments} comments by unknown authors`);
  if (attachments > 0)
    notes.push(`${attachments} attachments (files are not in the export)`);

  return notes.length > 0 ? `Skipped: ${notes.join("; ")}` : undefined;
}

export function ImportDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onRequest = () => {
      setFile(null);
      setOpen(true);
    };
    document.addEventListener("data.import", onRequest);
    return () => document.removeEventListener("data.import", onRequest);
  }, []);

  const importFile = useMutation({
    ...importExportFileMutation(),
    onSuccess: async (result: ImportResult) => {
      // New projects change the sidebar, which never unmounts and would otherwise not show them
      // until a full reload.
      await invalidateProjectLists(queryClient);
      toast.success(summarise(result), { description: skippedNote(result) });
      setOpen(false);
    },
    onError: (error) =>
      toast.error(
        "errors" in error && Array.isArray(error.errors)
          ? (error.errors[0]?.message ?? "This file could not be imported")
          : "This file could not be imported",
      ),
  });

  const submit = async () => {
    if (!file) return;

    let envelope: ExportEnvelope;
    try {
      // Parsed here rather than posted as a file: the endpoint takes the envelope as its body,
      // so a file that is not even JSON is worth catching before it becomes a request.
      envelope = JSON.parse(await file.text());
    } catch {
      toast.error("That file is not valid JSON");
      return;
    }

    importFile.mutate({ body: envelope });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import data</DialogTitle>
          <DialogDescription>
            Reads a JSON file exported from Blitz Task. It only ever creates new
            projects — nothing existing is changed or overwritten. Attached
            files are not restored, since the export does not carry them.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="cursor-pointer"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!file || importFile.isPending} onClick={submit}>
            {importFile.isPending && <Spinner className="size-4" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
