import { IconListCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ProjectDetails } from "@/api";
import {
  getProjectQueryKey,
  setChecklistItemDoneMutation,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

/**
 * A checklist row as the form holds it. `id` is null for a row added in the sheet and not yet
 * saved; `isDone` is carried so the row can render its state, but it is never submitted — the
 * task request has no field for it.
 */
export type ChecklistFormItem = {
  id: number | null;
  text: string;
  isDone: boolean;
};

type Props = {
  value: ChecklistFormItem[];
  onChange: (next: ChecklistFormItem[]) => void;
  projectId: number;
  /** Null while the task is being created: there is no row yet to tick. */
  taskId: number | null;
};

const MAX_ITEMS = 20;

/**
 * The task's checklist. Two write paths on purpose, and the split is the whole design:
 *
 * - **Text and order** are form state, saved with the task. That is what lets a checklist be
 *   written while the task itself is still being created, which is the trap L25.6 had to undo
 *   for reminders.
 * - **Ticking** goes straight to the API and applies immediately. A checkbox that only persists
 *   once you also press "Save changes" is the friction that stops a checklist being used at all,
 *   and because the task request carries no ticked state, a save can never undo a tick made
 *   while the sheet was open.
 */
export function TaskChecklist({ value, onChange, projectId, taskId }: Props) {
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const done = value.filter((i) => i.isDone).length;

  const setDone = useMutation({
    ...setChecklistItemDoneMutation(),
    onSuccess: (_updated, variables) => {
      // The board hands the sheet a ProjectTaskDetails from this cache, so a tick that is not
      // written back here comes off as lost the moment the sheet is closed and reopened —
      // exactly the staleness the reminder seeding had to be fixed for.
      queryClient.setQueryData(
        getProjectQueryKey({ path: { projectId } }),
        (old: ProjectDetails): ProjectDetails => ({
          ...old,
          columns: old.columns.map((col) => ({
            ...col,
            tasks: col.tasks.map((t) =>
              Number(t.id) === Number(variables.path.taskId)
                ? {
                    ...t,
                    checklistItems: t.checklistItems.map((item) =>
                      Number(item.id) === Number(variables.path.itemId)
                        ? { ...item, isDone: variables.body.isDone }
                        : item,
                    ),
                  }
                : t,
            ),
          })),
        }),
      );
    },
  });

  const addItem = () => {
    const text = draft.trim();
    if (!text || value.length >= MAX_ITEMS) return;
    onChange([...value, { id: null, text, isDone: false }]);
    setDraft("");
    draftRef.current?.focus();
  };

  const toggleItem = (index: number, isDone: boolean) => {
    const item = value[index];
    if (item.id === null || taskId === null) return;

    onChange(value.map((i, idx) => (idx === index ? { ...i, isDone } : i)));

    setDone.mutate(
      {
        path: { projectId, taskId, itemId: item.id },
        body: { isDone },
      },
      {
        onError: () => {
          onChange(
            value.map((i, idx) =>
              idx === index ? { ...i, isDone: !isDone } : i,
            ),
          );
          toast.error("Failed to update the checklist");
        },
      },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <IconListCheck className="size-4" />
          Checklist
        </span>
        {value.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {done}/{value.length}
          </span>
        )}
      </div>

      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((item, index) => (
            <div
              // Saved rows are stable by id; an unsaved one has only its position to be keyed by.
              key={item.id ?? `new-${index}`}
              className="flex items-center gap-2"
            >
              <Checkbox
                checked={item.isDone}
                // An item that has never been saved has no row to patch. Ticking it would have
                // to become form state, and then the split this component rests on is gone.
                disabled={item.id === null || taskId === null}
                onCheckedChange={(checked) =>
                  toggleItem(index, checked === true)
                }
                aria-label={item.text}
                title={
                  item.id === null
                    ? "Save the task to tick this off"
                    : undefined
                }
              />
              <Input
                value={item.text}
                onChange={(e) =>
                  onChange(
                    value.map((i, idx) =>
                      idx === index ? { ...i, text: e.target.value } : i,
                    ),
                  )
                }
                maxLength={200}
                className={`h-8 border-transparent bg-transparent px-1.5 shadow-none focus-visible:border-input focus-visible:bg-background ${
                  item.isDone ? "text-muted-foreground line-through" : ""
                }`}
              />
              <button
                type="button"
                aria-label={`Remove ${item.text}`}
                className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                onClick={() =>
                  onChange(value.filter((_, idx) => idx !== index))
                }
              >
                <IconX className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length < MAX_ITEMS && (
        <div className="flex gap-2">
          <Input
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a step and press Enter"
            maxLength={200}
            className="h-8"
            onKeyDown={(e) => {
              // Enter inside the task sheet would otherwise submit the whole form, saving the
              // task when the user meant to add a line to the list.
              if (e.key !== "Enter") return;
              e.preventDefault();
              addItem();
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={addItem}
            disabled={!draft.trim()}
          >
            <IconPlus className="size-3.5" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
