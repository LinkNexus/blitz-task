import { IconBell, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createTaskReminderMutation,
  deleteTaskReminderMutation,
  listTaskRemindersOptions,
  listTaskRemindersQueryKey,
} from "@/api/@tanstack/react-query.gen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Offsets offered in the UI. The API accepts any number of minutes; these are the useful ones. */
const PRESETS = [
  { minutes: 15, label: "15 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 60 * 24, label: "1 day before" },
  { minutes: 60 * 24 * 7, label: "1 week before" },
] as const;

function labelFor(minutes: number): string {
  return (
    PRESETS.find((p) => p.minutes === minutes)?.label ??
    `${minutes} minutes before`
  );
}

type Props = {
  projectId: number;
  taskId: number;
  /** Reminders are relative to the due date, so there is nothing to offer without one. */
  hasDueDate: boolean;
};

export function TaskReminders({ projectId, taskId, hasDueDate }: Props) {
  const queryClient = useQueryClient();
  const path = { projectId, taskId };

  const { data: reminders } = useQuery({
    ...listTaskRemindersOptions({ path }),
    enabled: hasDueDate,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: listTaskRemindersQueryKey({ path }),
    });

  const create = useMutation({
    ...createTaskReminderMutation(),
    onSuccess: invalidate,
    onError: (error) =>
      // 409 when the same offset is already set — worth saying out loud, since the UI
      // otherwise looks like it silently ignored the click.
      toast.error("Couldn't add that reminder", {
        description: "message" in error ? error.message : undefined,
      }),
  });

  const remove = useMutation({
    ...deleteTaskReminderMutation(),
    onSuccess: invalidate,
    onError: () => toast.error("Couldn't remove that reminder"),
  });

  if (!hasDueDate) {
    return (
      <div className="space-y-1.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <IconBell className="size-4" />
          Reminders
        </span>
        <p className="text-xs text-muted-foreground">
          Set a due date to be reminded before it.
        </p>
      </div>
    );
  }

  const taken = new Set(
    (reminders ?? []).map((r) => Number(r.minutesBeforeDue)),
  );
  const available = PRESETS.filter((p) => !taken.has(p.minutes));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <IconBell className="size-4" />
          Reminders
        </span>

        {available.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={create.isPending}
              >
                <IconPlus className="size-3.5" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {available.map((preset) => (
                <DropdownMenuItem
                  key={preset.minutes}
                  onSelect={() =>
                    create.mutate({
                      path,
                      body: { minutesBeforeDue: preset.minutes },
                    })
                  }
                >
                  {preset.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {reminders?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {reminders.map((reminder) => (
            <Badge
              key={String(reminder.id)}
              variant="secondary"
              className="gap-1 pr-1 font-normal"
            >
              {labelFor(Number(reminder.minutesBeforeDue))}
              {reminder.sentAt && (
                <span className="text-muted-foreground">· sent</span>
              )}
              <button
                type="button"
                aria-label={`Remove reminder ${labelFor(Number(reminder.minutesBeforeDue))}`}
                className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                onClick={() =>
                  remove.mutate({
                    path: { ...path, reminderId: Number(reminder.id) },
                  })
                }
              >
                <IconX className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No reminders set.</p>
      )}
    </div>
  );
}
