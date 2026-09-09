import { IconBell, IconPlus, IconX } from "@tabler/icons-react";
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
  /** Offsets in minutes before the due date. */
  value: number[];
  onChange: (next: number[]) => void;
  /** Reminders are relative to the due date, so there is nothing to offer without one. */
  hasDueDate: boolean;
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
                >
                  {preset.label}
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
