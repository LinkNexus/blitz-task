import { IconRepeat } from "@tabler/icons-react";
import type { RecurrenceFrequency } from "@/api";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** The rule as the form holds it. Null is a one-off task. */
export type RecurrenceFormValue = {
  frequency: RecurrenceFrequency;
  interval: number;
  /** `Date.getDay()` values — 0 is Sunday. Only meaningful for WEEKLY. */
  weekdays: number[];
} | null;

type Props = {
  value: RecurrenceFormValue;
  onChange: (next: RecurrenceFormValue) => void;
  /** A rule advances from the due date, so without one there is nothing to repeat. */
  hasDueDate: boolean;
};

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: "DAILY", label: "day" },
  { value: "WEEKLY", label: "week" },
  { value: "MONTHLY", label: "month" },
  { value: "YEARLY", label: "year" },
];

// Monday first: the week starts where the working week does, and the underlying values stay
// Date.getDay()'s, so Sunday is 0 even though it is rendered last.
const WEEKDAYS = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 0, label: "S" },
] as const;

/**
 * How a task repeats. A form field like the checklist and the reminders: the rule rides on the
 * task's own request, and only the *next* occurrence is ever written — completing this task is
 * what creates the following one.
 *
 * Editing the rule therefore changes what happens next, not a series stretching into the future,
 * because no such rows exist yet.
 */
export function TaskRecurrence({ value, onChange, hasDueDate }: Props) {
  const label = (
    <span className="flex items-center gap-1.5 text-sm font-medium">
      <IconRepeat className="size-4" />
      Repeat
    </span>
  );

  if (!hasDueDate) {
    return (
      <div className="space-y-1.5">
        {label}
        <p className="text-xs text-muted-foreground">
          Set a due date for this task to repeat.
        </p>
      </div>
    );
  }

  const toggleWeekday = (day: number) => {
    if (!value) return;
    const weekdays = value.weekdays.includes(day)
      ? value.weekdays.filter((d) => d !== day)
      : [...value.weekdays, day];
    onChange({ ...value, weekdays });
  };

  return (
    <div className="space-y-2">
      {label}

      <div className="flex items-center gap-2">
        <Select
          value={value?.frequency ?? "NONE"}
          onValueChange={(next) =>
            onChange(
              next === "NONE"
                ? null
                : {
                    frequency: next as RecurrenceFrequency,
                    interval: value?.interval ?? 1,
                    weekdays: value?.weekdays ?? [],
                  },
            )
          }
        >
          <SelectTrigger className="h-8 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">Does not repeat</SelectItem>
            {FREQUENCIES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                Every {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {value && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">every</span>
            <Input
              type="number"
              min={1}
              max={365}
              value={value.interval}
              onChange={(e) =>
                onChange({
                  ...value,
                  // An empty input parses as NaN, which would be submitted and rejected; hold
                  // it at 1 rather than letting the field go blank mid-edit.
                  interval: Math.max(1, Number(e.target.value) || 1),
                })
              }
              className="h-8 w-16"
            />
            <span className="text-xs text-muted-foreground">
              {FREQUENCIES.find((f) => f.value === value.frequency)?.label}
              {value.interval > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {value?.frequency === "WEEKLY" && (
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((day, index) => {
            const selected = value.weekdays.includes(day.value);
            return (
              <button
                // The two Tuesdays-and-Saturdays share a letter, so the label cannot be the key.
                key={day.value}
                type="button"
                onClick={() => toggleWeekday(day.value)}
                aria-pressed={selected}
                aria-label={
                  [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ][day.value]
                }
                className={`size-7 rounded-md border text-xs transition-colors ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                {WEEKDAYS[index].label}
              </button>
            );
          })}
        </div>
      )}

      {value && (
        <p className="text-xs text-muted-foreground">
          The next one is created when you move this task to the last column.
        </p>
      )}
    </div>
  );
}
