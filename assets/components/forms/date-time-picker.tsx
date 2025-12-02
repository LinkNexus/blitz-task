import {Calendar} from "@/components/ui/calendar.tsx";
import {Input} from "@/components/ui/input.tsx";
import {ChevronDownIcon} from "lucide-react";
import {type ComponentProps, memo, useEffect, useRef, useState} from "react";
import {Button} from "../ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "../ui/popover";

function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(date: Date | undefined): string {
  if (!date) {
    return "00:00:00";
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

type Props = {
  value: Date | undefined;
  onChange?: (date: Date | undefined) => void;
} & Omit<ComponentProps<"input">, "onChange" | "value">;

export const DateTimePicker = memo(function DateTimePicker(props: Props) {
  const {value, onChange} = props;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(value);
  const [timeValue, setTimeValue] = useState<string>(formatTime(value));

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (onChange) {
      onChange(date);
    }
  }, [date, onChange]);

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-between font-normal">
              {date ? formatDate(date) : "Select date"}
              <ChevronDownIcon/>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              onSelect={(selectedDate) => {
                if (selectedDate) {
                  // Preserve time if date already exists
                  if (date) {
                    const newDate = new Date(selectedDate);
                    newDate.setHours(date.getHours());
                    newDate.setMinutes(date.getMinutes());
                    newDate.setSeconds(date.getSeconds());
                    setDate(newDate);
                  } else {
                    setDate(selectedDate);
                  }
                } else {
                  setDate(undefined);
                  setTimeValue("00:00:00");
                }
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-3">
        <Input
          onChange={(e) => {
            const timeString = e.target.value;
            setTimeValue(timeString);
            const parts = timeString.split(":");

            setDate((prev) => {
              if (!prev) return undefined;
              const next = new Date(prev);
              next.setHours(Number.parseInt(parts[0], 10) || 0);
              next.setMinutes(Number.parseInt(parts[1], 10) || 0);
              next.setSeconds(Number.parseInt(parts[2], 10) || 0);
              return next;
            });
          }}
          disabled={!date}
          type="time"
          step="1"
          value={timeValue}
          className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </div>

      <input
        ref={inputRef}
        type="hidden"
        value={date ? date.toISOString() : ""}
      />
    </div>
  );
});
