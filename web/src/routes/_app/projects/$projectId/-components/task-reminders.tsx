import { IconBell, IconPlus, IconX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTaskDate } from "@/lib/task-dates";

/**
 * Offsets offered in the UI. The API has always accepted any number of minutes and
 * `RemindAt = DueDate - minutes` has always been exact — what made the short ones pointless was
 * the *due date*, which every picker wrote as local midnight. "10 minutes before" meant 23:50
 * the previous night. Now that a deadline can carry a real time, the sub-hour offsets mean
 * something, so they are offered.
 */
const PRESETS = [
  { minutes: 5, label: "5 minutes before" },
  { minutes: 10, label: "10 minutes before" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 30, label: "30 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 60 * 2, label: "2 hours before" },
  { minutes: 60 * 24, label: "1 day before" },
  { minutes: 60 * 24 * 2, label: "2 days before" },
  { minutes: 60 * 24 * 7, label: "1 week before" },
] as const;

function labelFor(minutes: number): string {
  return (
    PRESETS.find((p) => p.minutes === minutes)?.label ??
    `${minutes} minutes before`
  );
}

/**
 * What a chip actually resolves to. An offset is only meaningful against the deadline it hangs
 * off, and "1 day before" on a task due at 09:00 firing at 09:00 the previous day is not
 * something a person should have to work out — least of all now that the answer depends on
 * whether a time was set at all.
 */
function resolvedAt(
  dueDate: string | null,
  hasDueTime: boolean,
  minutes: number,
): string | null {
  if (!dueDate) return null;
  const at = new Date(new Date(dueDate).getTime() - minutes * 60_000);
  return formatTaskDate(at.toISOString(), hasDueTime, "short");
}

type Props = {
  /** Offsets in minutes before the due date. */
  value: number[];
  onChange: (next: number[]) => void;
  /** Reminders are relative to the due date, so there is nothing to offer without one. */
  hasDueDate: boolean;
  /** The deadline itself, so a chip can say when it will actually fire. */
  dueDate?: string | null;
  /** Whether that deadline carries a chosen time, so the resolved moment reads the same way. */
  hasDueTime?: boolean;
  /** Offsets that have already fired, so a chip can say so. */
  sentOffsets?: number[];
};

/**
 * A form field, not a save button: adding a reminder edits form state and the task's own
 * create/update request carries it. The reminders endpoints still exist and still work, but
 * they need a task that already has an id and a stored due date — which is what made setting a
 * deadline and a reminder together take two saves and a reopen.
 */
export function TaskReminders({
  value,
  onChange,
  hasDueDate,
  dueDate = null,
  hasDueTime = false,
  sentOffsets = [],
}: Props) {
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

  const selected = [...value].sort((a, b) => a - b);
  const available = PRESETS.filter((p) => !value.includes(p.minutes));

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
              >
                <IconPlus className="size-3.5" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {available.map((preset) => (
                <DropdownMenuItem
                  key={preset.minutes}
                  onSelect={() => onChange([...value, preset.minutes])}
                  className="flex items-center justify-between gap-6"
                >
                  <span>{preset.label}</span>
                  {resolvedAt(dueDate, hasDueTime, preset.minutes) && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {resolvedAt(dueDate, hasDueTime, preset.minutes)}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((minutes) => (
            <Badge
              key={minutes}
              variant="secondary"
              className="gap-1 pr-1 font-normal"
            >
              {labelFor(minutes)}
              {resolvedAt(dueDate, hasDueTime, minutes) && (
                <span className="text-muted-foreground tabular-nums">
                  · {resolvedAt(dueDate, hasDueTime, minutes)}
                </span>
              )}
              {sentOffsets.includes(minutes) && (
                <span className="text-muted-foreground">· sent</span>
              )}
              <button
                type="button"
                aria-label={`Remove reminder ${labelFor(minutes)}`}
                className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                onClick={() => onChange(value.filter((m) => m !== minutes))}
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
