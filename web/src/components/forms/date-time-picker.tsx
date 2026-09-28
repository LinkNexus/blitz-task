import { IconCalendar, IconX } from "@tabler/icons-react";
import { format } from "date-fns";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A date, and optionally a time of day.
 *
 * **The presence of a time is the flag.** The server stores an instant either way and carries a
 * separate `hasTime` boolean saying whether a person chose the clock part; rather than surface
 * that as a checkbox, the time input *is* it — empty means "a date", filled means "this
 * moment". So there is one control and no way to have a time that does not count, or a flag
 * with no time behind it.
 *
 * The instant is always built in the **viewer's local zone**, which is the only zone the user
 * has expressed anything in. With no time it is local midnight, exactly as before — which is
 * why every task that predates this keeps rendering identically.
 */
export function DateTimePicker({
  value,
  hasTime,
  onChange,
  placeholder = "No date",
  disabled,
  id,
  "aria-invalid": ariaInvalid,
}: {
  /** ISO instant, or null for no date at all. */
  value: string | null;
  hasTime: boolean;
  onChange: (value: string | null, hasTime: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? new Date(value) : undefined;

  // `type="time"` speaks 24h "HH:mm" regardless of how the browser presents it to the user.
  const timeValue = selected && hasTime ? format(selected, "HH:mm") : "";

  const setDatePart = (day: Date | undefined) => {
    if (!day) return onChange(null, false);
    const next = new Date(day);
    if (selected && hasTime)
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    else next.setHours(0, 0, 0, 0);
    onChange(next.toISOString(), hasTime);
  };

  const setTimePart = (raw: string) => {
    if (!raw) {
      // Clearing the time drops back to a plain date rather than to no date: the day is still
      // something the user chose.
      if (!selected) return onChange(null, false);
      const next = new Date(selected);
      next.setHours(0, 0, 0, 0);
      return onChange(next.toISOString(), false);
    }

    const [h, m] = raw.split(":").map(Number);
    // Typing a time before picking a day means today — refusing it would be a dead input.
    const next = selected ? new Date(selected) : new Date();
    next.setHours(h, m, 0, 0);
    onChange(next.toISOString(), true);
  };

  const label = !selected
    ? placeholder
    : hasTime
      ? format(selected, "MMM d, yyyy 'at' HH:mm")
      : format(selected, "MMM d, yyyy");

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            className={cn(
              "h-9 w-full justify-start gap-2 px-3 font-normal",
              !selected && "text-muted-foreground",
            )}
          >
            <IconCalendar className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setDatePart}
            autoFocus
          />
          <div className="flex items-center gap-2 border-t p-3">
            <span className="text-xs font-medium text-muted-foreground">
              Time
            </span>
            <Input
              type="time"
              value={timeValue}
              onChange={(e) => setTimePart(e.target.value)}
              className="h-8 w-[7.5rem]"
              aria-label="Time of day"
            />
            {hasTime && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setTimePart("")}
              >
                Clear time
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selected && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground"
          aria-label="Clear date"
          onClick={() => onChange(null, false)}
        >
          <IconX className="size-4" />
        </Button>
      )}
    </div>
  );
}
