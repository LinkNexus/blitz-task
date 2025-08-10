import {Avatar, AvatarFallback, AvatarImage,} from "@/components/ui/avatar.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Calendar} from "@/components/ui/calendar.tsx";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,} from "@/components/ui/command.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage,} from "@/components/ui/form.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Popover, PopoverContent, PopoverTrigger,} from "@/components/ui/popover.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select.tsx";
import {Textarea} from "@/components/ui/textarea.tsx";
import {apiFetch} from "@/lib/fetch.ts";
import {cn} from "@/lib/utils.ts";
import type {Label, Task, TaskColumn} from "@/types.ts";
import {zodResolver} from "@hookform/resolvers/zod";
import {format} from "date-fns";
import {AlertCircle, Calendar as CalendarIcon, Flag, Loader2, Plus, Tag, X,} from "lucide-react";
import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import {toast} from "sonner";
import {z} from "zod";
import {useAppStore} from "@/lib/store.ts";

const taskSchema = z.object({
  name: z
    .string()
    .min(1, "Task name is required")
    .max(255, "Task name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  priority: z.enum(["low", "medium", "high", "urgent"], {
    message: "Priority is required",
  }),
  columnId: z.number({
    message: "Column is required",
  }),
  assigneeIds: z.array(z.number()).optional(),
  labelIds: z.array(z.number()).optional(),
  dueAt: z.date().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null; // For editing existing task
  columns: TaskColumn[];
  defaultColumnId?: number; // Default column when creating new task
}

export function TaskModal({
  isOpen,
  onClose,
  task,
  columns,
  defaultColumnId,
}: TaskModalProps) {
  const isEditing = !!task;
  const [availableLabels, setAvailableLabels] = useState(
    Array.from(
      new Map(
        columns.flatMap(c => c.tasks)
          .flatMap(t => t.labels)
          .map(l => [l.id, l])
      ).values()
    )
  );
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [labelSearchValue, setLabelSearchValue] = useState("");
  const users = Array.from(
    new Map(
      columns.flatMap(c => c.tasks)
        .flatMap(t => t.assignees)
        .map(user => [user.id, user])
    ).values()
  );

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: task?.name || "",
      description: task?.description || "",
      priority: task?.priority || "medium",
      columnId: task
        ? // For editing existing tasks, use the task's current column
        columns.find((col) => col.tasks?.some((t) => t.id === task.id))?.id ||
        columns[0]?.id
        : // For new tasks, use defaultColumnId or first column
        defaultColumnId || columns[0]?.id,
      assigneeIds: task?.assignees?.map((a) => a.id) || [],
      labelIds: task?.labels?.map((l) => l.id) || [],
      dueAt: task?.dueAt ? new Date(task.dueAt) : undefined,
    },
  });

  const {
    handleSubmit,
    formState: {isSubmitting},
    reset,
    watch,
    setValue,
  } = form;

  const watchedAssigneeIds = watch("assigneeIds") || [];
  const watchedLabelIds = watch("labelIds") || [];

  const {addTask, updateTask} = useAppStore(state => state);

  // Update the form when defaultColumnId changes (for new tasks)
  useEffect(() => {
    if (!isEditing && defaultColumnId) {
      setValue("columnId", defaultColumnId);
    }
  }, [defaultColumnId, isEditing, setValue]);

  // Reset form when modal opens with new task/column data
  useEffect(() => {
    if (isOpen) {
      const newColumnId = task
        ? // For editing existing tasks, find the task's current column
        columns.find((col) => col.tasks?.some((t) => t.id === task.id))?.id ||
        columns[0]?.id
        : // For new tasks, use defaultColumnId or first column
        defaultColumnId || columns[0]?.id;

      reset({
        name: task?.name || "",
        description: task?.description || "",
        priority: task?.priority || "medium",
        columnId: newColumnId,
        assigneeIds: task?.assignees?.map((a) => a.id) || [],
        labelIds: task?.labels?.map((l) => l.id) || [],
        dueAt: task?.dueAt ? new Date(task.dueAt) : undefined,
      });
    }
  }, [isOpen, task, defaultColumnId, columns, reset]);

  const onSubmit = async (data: TaskFormData) => {
    try {
      const createdOrUpdatedTask = await apiFetch<Task>(isEditing ? `/api/tasks/${task.id}` : "/api/tasks", {
        method: isEditing ? "PUT" : "POST",
        data: {
          ...data,
          dueAt: data.dueAt?.toISOString(),
        },
      });

      if (isEditing) {
        updateTask(createdOrUpdatedTask);
        toast.success(
          `Task "${createdOrUpdatedTask.name}" updated successfully`
        );
      } else {
        addTask(data.columnId, createdOrUpdatedTask);
        toast.success(
          `Task "${createdOrUpdatedTask.name}" created successfully`
        );
      }

      handleClose();
    } catch (error) {
      console.error("Failed to save task:", error);
      toast.error(
        isEditing ? "Failed to update task" : "Failed to create task"
      );
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addAssignee = (userId: number) => {
    if (!watchedAssigneeIds.includes(userId)) {
      setValue("assigneeIds", [...watchedAssigneeIds, userId]);
    }
  };

  const removeAssignee = (userId: number) => {
    setValue(
      "assigneeIds",
      watchedAssigneeIds.filter((id) => id !== userId)
    );
  };

  const addLabel = (labelId: number) => {
    const currentIds = watchedLabelIds;
    if (!currentIds.includes(labelId)) {
      setValue("labelIds", [...currentIds, labelId]);
    }
    // Clear search when label is added
    setLabelSearchValue("");
  };

  const removeLabel = (labelId: number) => {
    setValue(
      "labelIds",
      watchedLabelIds.filter((id) => id !== labelId)
    );
  };

  const createNewLabel = async (labelName: string) => {
    const trimmedName = labelName.trim();
    if (!trimmedName) return;

    // Check if label already exists (case-insensitive)
    const existingLabel = availableLabels.find(
      (label) => label.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingLabel) {
      // If label exists, just add it instead of creating a new one
      addLabel(existingLabel.id);
      toast.info(`Label "${existingLabel.name}" already exists and was added`);
      return;
    }

    setIsCreatingLabel(true);
    try {
      // Create the new label via API
      const newLabel = await apiFetch<Label>("/api/labels", {
        method: "POST",
        data: {name: trimmedName},
      });

      // Add the new label to available labels
      setAvailableLabels((prev) => [...prev, newLabel]);

      // Automatically add the new label to the task
      addLabel(newLabel.id);

      toast.success(`Label "${newLabel.name}" created and added`);
    } catch (error) {
      console.error("Failed to create label:", error);
      toast.error("Failed to create label");
    } finally {
      setIsCreatingLabel(false);
      // Clear search after creating label
      setLabelSearchValue("");
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <AlertCircle className="w-4 h-4 text-red-500"/>;
      case "high":
        return <Flag className="w-4 h-4 text-orange-500"/>;
      case "medium":
        return <Flag className="w-4 h-4 text-yellow-500"/>;
      case "low":
        return <Flag className="w-4 h-4 text-green-500"/>;
      default:
        return <Flag className="w-4 h-4 text-gray-500"/>;
    }
  };

  const getLabelColor = (labelName: string) => {
    const colors = {
      Frontend: "bg-blue-100 text-blue-800",
      Backend: "bg-purple-100 text-purple-800",
      Bug: "bg-red-100 text-red-800",
      Feature: "bg-green-100 text-green-800",
      Design: "bg-pink-100 text-pink-800",
      Testing: "bg-indigo-100 text-indigo-800",
    };
    return (
      colors[labelName as keyof typeof colors] || "bg-gray-100 text-gray-800"
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the task details below."
              : "Fill in the details to create a new task."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Task Name */}
            <FormField
              control={form.control}
              name="name"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Task Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter task name..." {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter task description..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Priority *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority"/>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center gap-2">
                            {getPriorityIcon("low")}
                            <span>Low</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="medium">
                          <div className="flex items-center gap-2">
                            {getPriorityIcon("medium")}
                            <span>Medium</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center gap-2">
                            {getPriorityIcon("high")}
                            <span>High</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="urgent">
                          <div className="flex items-center gap-2">
                            {getPriorityIcon("urgent")}
                            <span>Urgent</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage/>
                  </FormItem>
                )}
              />

              {/* Column */}
              <FormField
                control={form.control}
                name="columnId"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Column *</FormLabel>
                    <Select
                      disabled={isEditing}
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select column"/>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {columns.map((column) => (
                          <SelectItem
                            key={column.id}
                            value={column.id.toString()}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{backgroundColor: column.color}}
                              />
                              <span>{column.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage/>
                  </FormItem>
                )}
              />
            </div>

            {/* Due Date */}
            <FormField
              control={form.control}
              name="dueAt"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50"/>
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                      {field.value && (
                        <div className="p-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => field.onChange(undefined)}
                            className="w-full"
                          >
                            Clear date
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <FormMessage/>
                </FormItem>
              )}
            />

            {/* Assignees */}
            <div className="space-y-3">
              <FormLabel>Assignees</FormLabel>

              {/* Selected Assignees */}
              {watchedAssigneeIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {watchedAssigneeIds.map((userId) => {
                    const user = users.find((u) => u.id === userId);
                    if (!user) return null;

                    return (
                      <Badge
                        key={userId}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <Avatar className="w-4 h-4">
                          <AvatarImage src="" alt={user.name}/>
                          <AvatarFallback className="text-xs">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span>{user.name}</span>
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => removeAssignee(userId)}
                        />
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Add Assignees */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2"/>
                    Add Assignee
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <Command>
                    <CommandInput placeholder="Search users..."/>
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandGroup>
                      {users
                        .filter((user) => !watchedAssigneeIds.includes(user.id))
                        .map((user) => (
                          <CommandItem
                            key={user.id}
                            onSelect={() => addAssignee(user.id)}
                          >
                            <Avatar className="w-6 h-6 mr-2">
                              <AvatarImage src="" alt={user.name}/>
                              <AvatarFallback className="text-xs">
                                {user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span>{user.name}</span>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Labels */}
            <div className="space-y-3">
              <FormLabel>Labels</FormLabel>

              {/* Selected Labels */}
              {watchedLabelIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {watchedLabelIds.map((labelId) => {
                    const label = availableLabels.find((l) => l.id === labelId);
                    if (!label) return null;

                    return (
                      <Badge
                        key={labelId}
                        variant="secondary"
                        className={cn(
                          "flex items-center gap-1",
                          getLabelColor(label.name)
                        )}
                      >
                        <span>{label.name}</span>
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => removeLabel(labelId)}
                        />
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Add Labels */}
              <Popover
                onOpenChange={(open) => !open && setLabelSearchValue("")}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2"/>
                    Add Label
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <Command>
                    <CommandInput
                      placeholder="Search or create labels..."
                      value={labelSearchValue}
                      onValueChange={setLabelSearchValue}
                    />
                    <CommandEmpty>
                      {labelSearchValue.trim() && (
                        <div className="p-2">
                          <CommandItem
                            onSelect={() => createNewLabel(labelSearchValue)}
                            className="cursor-pointer"
                            disabled={isCreatingLabel}
                          >
                            {isCreatingLabel ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                            ) : (
                              <Tag className="w-4 h-4 mr-2"/>
                            )}
                            <span>Create "{labelSearchValue}"</span>
                          </CommandItem>
                        </div>
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {/* Show "Create new" option even when there are existing labels */}
                      {labelSearchValue.trim() &&
                        !availableLabels.some(
                          (label) =>
                            label.name.toLowerCase() ===
                            labelSearchValue.toLowerCase()
                        ) && (
                          <CommandItem
                            onSelect={() => createNewLabel(labelSearchValue)}
                            className="cursor-pointer border-b"
                            disabled={isCreatingLabel}
                          >
                            {isCreatingLabel ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                            ) : (
                              <Tag className="w-4 h-4 mr-2"/>
                            )}
                            <span>Create "{labelSearchValue}"</span>
                          </CommandItem>
                        )}

                      {availableLabels
                        .filter((label) => !watchedLabelIds.includes(label.id))
                        .map((label) => (
                          <CommandItem
                            key={label.id}
                            onSelect={() => addLabel(label.id)}
                          >
                            <div
                              className={cn(
                                "w-3 h-3 rounded-full mr-2",
                                getLabelColor(label.name)
                              )}
                            />
                            <span>{label.name}</span>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                )}
                {isEditing ? "Update Task" : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
