import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createProjectTaskMutation,
  getInboxOptions,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { aspNetFormSerializer } from "@/lib/form-serializer";
import { invalidateUserTasks } from "@/lib/query-invalidation";

/** Opens the capture dialog from anywhere, without threading state through the layout. */
export function requestQuickCapture() {
  document.dispatchEvent(new CustomEvent("task.capture"));
}

/** Typing a letter into a field must not open a dialog over what you were writing. */
function isTypingInto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * Capture goes to the Inbox unconditionally — no project picker, no column, no due date.
 * The whole point of the affordance is that deciding where a task belongs is a separate act
 * from writing it down; /inbox is where the deciding happens, through "File into".
 */
export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetched here rather than in the loader of every route: the dialog is mounted app-wide, and
  // the Inbox is created by this very request the first time anyone captures anything.
  const { data: inbox } = useQuery(getInboxOptions());

  useEffect(() => {
    const onCapture = () => setOpen(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingInto(e.target)) return;
      e.preventDefault();
      setOpen(true);
    };

    document.addEventListener("task.capture", onCapture);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("task.capture", onCapture);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const capture = useMutation({
    ...createProjectTaskMutation(),
    onSuccess: () => {
      // The capture lands in a list this component does not render — the Inbox page, the
      // dashboard, Today — so there is nothing to write into the cache, only to drop.
      invalidateUserTasks(queryClient);
      toast.success("Captured to your Inbox");
      setName("");
      setOpen(false);
    },
    onError: () => toast.error("Failed to capture the task"),
  });

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || !inbox) return;

    capture.mutate({
      bodySerializer: aspNetFormSerializer,
      path: {
        projectId: Number(inbox.projectId),
        columnId: Number(inbox.captureColumnId),
      },
      body: {
        name: trimmed,
        description: "",
        priority: "MEDIUM",
        tags: [],
        startDate: null,
        dueDate: null,
        assigneeIds: [],
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Quick capture</DialogTitle>
          <DialogDescription>
            Write it down now, decide where it belongs later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={name}
            placeholder="Buy milk"
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button
            onClick={submit}
            disabled={capture.isPending || !name.trim() || !inbox}
          >
            {capture.isPending && <Spinner />}
            Capture
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
