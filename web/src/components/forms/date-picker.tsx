import { IconCalendar } from "@tabler/icons-react";
import * as React from "react";
import { useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return !Number.isNaN(date.getTime());
}

type Props = React.ComponentProps<typeof InputGroupInput> & {
  value?: string;
  onValidDate?: (date: string) => void;
};

export function DatePicker({ value, onChange, onValidDate, ...props }: Props) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(
    value ? new Date(value.toString()) : undefined,
  );
  const [month, setMonth] = React.useState<Date | undefined>(date);
  const [currentValue, setValue] = React.useState(formatDate(date));

  useEffect(() => {
    if (date) {
      onValidDate?.(date.toISOString());
    }
  }, [date, onValidDate]);

  return (
    <InputGroup>
      <InputGroupInput
        {...props}
        value={currentValue}
        onChange={(e) => {
          onChange?.(e);
          const date = new Date(e.target.value);
          setValue(e.target.value);
          if (isValidDate(date)) {
            setDate(date);
            setMonth(date);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <InputGroupButton
              variant="ghost"
              size="icon-xs"
              aria-label="Select date"
            >
              <IconCalendar />
              <span className="sr-only">Select date</span>
            </InputGroupButton>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto overflow-hidden p-0"
            align="end"
            alignOffset={-8}
            sideOffset={10}
          >
            <Calendar
              mode="single"
              selected={date}
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                setDate(date);
                setValue(formatDate(date));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  );
}
