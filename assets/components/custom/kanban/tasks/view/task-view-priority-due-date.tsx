import type {FormErrors, Task} from "@/types.ts";
import {memo, useState} from "react";
import {useApiFetch} from "@/hooks/useApiFetch.ts";
import {toast} from "sonner";
import {CalendarIcon, Flag, RotateCcw, Save} from "lucide-react";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Badge} from "@/components/ui/badge";
import {Popover, PopoverContent} from "@/components/ui/popover";
import {PopoverTrigger} from "@/components/ui/popover.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Calendar} from "@/components/ui/calendar";
import {Separator} from "@/components/ui/separator.tsx";

type TaskProps = Pick<Task, "id" | "priority" | "dueAt">;

interface Props extends TaskProps {
  onUpdate: ({priority, dueAt}: Omit<TaskProps, "id">) => void;
}

const priorityOptions = [
  {
    value: "low",
    label: "Low",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    value: "medium",
    label: "Medium",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  {
    value: "high",
    label: "High",
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    value: "urgent",
    label: "Urgent",
    color: "bg-red-100 text-red-800 border-red-200",
  },
];

export const TaskViewPriorityDueDate = memo(function ({
  id,
  priority,
  dueAt,
  onUpdate
}: Props) {
  const [selectedPriority, setSelectedPriority] = useState(priority);
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(
    dueAt ? new Date(dueAt) : undefined
  );
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handlePriorityChange = (priority: string) => {
    setSelectedPriority(priority as Task["priority"]);
    setHasChanges(true);
  };

  const handleDueDateChange = (date: Date | undefined) => {
    setSelectedDueDate(date);
    setDueDateOpen(false);
    setHasChanges(true);
  };

  const {pending: isSaving, callback: save} = useApiFetch<Task, FormErrors>(
    `/api/tasks/${id}`,
    {
      method: "PATCH",
      data: {
        priority: selectedPriority,
        dueAt: selectedDueDate?.toISOString() || null,
      },
      onSuccess(data) {
        onUpdate({
          priority: data.priority,
          dueAt: data.dueAt,
        });
        setHasChanges(false);
        toast.success("Task updated successfully");
      },
      onError(error) {
        console.error("Failed to update task:", error);
        toast.error("Failed to update task");
      },
    },
    [id, selectedPriority, selectedDueDate?.toISOString()]
  );

  const handleReset = () => {
    setSelectedPriority(priority);
    setSelectedDueDate(dueAt ? new Date(dueAt) : undefined);
    setHasChanges(false);
  };

  const clearDueDate = () => {
    setSelectedDueDate(undefined);
    setHasChanges(true);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "No due date";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const currentPriority = priorityOptions.find(
    (p) => p.value === selectedPriority
  );
  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Flag className="w-4 h-4"/>
          Priority
        </div>
        <Select
          value={selectedPriority}
          onValueChange={handlePriorityChange}
        >
          <SelectTrigger>
            <SelectValue>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={currentPriority?.color}>
                  {currentPriority?.label}
                </Badge>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={option.color}>
                    {option.label}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator/>

      {/* Due Date */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarIcon className="w-4 h-4"/>
          Due Date
        </div>
        <div className="space-y-2">
          <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="w-4 h-4 mr-2"/>
                {formatDate(selectedDueDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDueDate}
                onSelect={handleDueDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {selectedDueDate && (
            <Button
              onClick={clearDueDate}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Clear Due Date
            </Button>
          )}
        </div>
      </div>

      {/* Save/Reset buttons */}
      {hasChanges && (
        <>
          <Separator/>
          <div className="flex gap-2">
            <Button
              onClick={async () => save()}
              disabled={isSaving}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2"/>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={isSaving}
            >
              <RotateCcw className="w-4 h-4"/>
            </Button>
          </div>
        </>
      )}
    </>
  )
});
