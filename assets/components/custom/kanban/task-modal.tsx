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
import {useApiFetch} from "@/hooks/useFetch.ts";
import {useThrottle} from "@/hooks/useThrottle.ts";
import {ApiError, apiFetch} from "@/lib/fetch.ts";
import {useAppStore} from "@/lib/store.ts";
import {cn, getLabelColor, getPriorityIcon} from "@/lib/utils.tsx";
import type {FormErrors, Label, Task, TaskColumn, Team} from "@/types.ts";
import {zodResolver} from "@hookform/resolvers/zod";
import {format} from "date-fns";
import {Calendar as CalendarIcon, Loader2, Plus, Tag, X,} from "lucide-react";
import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import {toast} from "sonner";
import {z} from "zod";

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
  teamMembers: Team["members"];
}

export function TaskModal({
  isOpen,
  onClose,
  task,
  columns,
  defaultColumnId,
  teamMembers
}: TaskModalProps) {
  const isEditing = !!task;

  // Labels
  const [labels, setLabels] = useState<Label[]>([]);
  const [searchedLabels, setSearchedLabels] = useState<Label[]>([]);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [labelSearchValue, setLabelSearchValue] = useState("");
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  const {addTask, updateTask} = useAppStore(state => state);
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
  const watchedDueAt = watch("dueAt");

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

      setLabels(task?.labels || []);

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

  async function onSubmit(data: TaskFormData) {
    try {
      const createdOrUpdatedTask = await apiFetch<Task>(
        isEditing ? `/api/tasks/${task.id}` : "/api/tasks",
        {
          method: isEditing ? "PUT" : "POST",
          data: {
            ...data,
            dueAt: data.dueAt?.toISOString(),
          },
        }
      );

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
  }

  function handleClose() {
    reset();
    setLabelSearchValue("");
    onClose();
  }

  function addAssignee(userId: number) {
    if (!watchedAssigneeIds.includes(userId)) {
      setValue("assigneeIds", [...watchedAssigneeIds, userId]);
    }
  }

  function removeAssignee(userId: number) {
    setValue(
      "assigneeIds",
      watchedAssigneeIds.filter((id) => id !== userId)
    );
  }

  const {callback: searchLabels, pending: isSearchingLabels} = useApiFetch("/api/labels", {
    onSuccess: setSearchedLabels,
    onError(error) {
      console.error("Failed to fetch labels:", error);
    },
  });

  const throttledSearchLabels = useThrottle(searchLabels, 300);

  useEffect(() => {
    if (isLabelModalOpen) {
      throttledSearchLabels({
        searchParams: {
          query: labelSearchValue.trim()
        }
      })
    }
  }, [labelSearchValue, isLabelModalOpen]);

  function addLabel(label: Label) {
    if (!watchedLabelIds.includes(label.id)) {
      setLabels([...labels, label]);
      setValue("labelIds", [...watchedLabelIds, label.id]);
    }
    // Clear search when label is added
    setLabelSearchValue("");
  }

  function removeLabel(labelId: number) {
    setValue(
      "labelIds",
      watchedLabelIds.filter((id) => id !== labelId)
    );
  }

  function createLabel(labelName: string) {
    const trimmedName = labelName.trim();

    if (!trimmedName) return;

    const existingLabel = searchedLabels.find(l => l.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingLabel) {
      addLabel(existingLabel);
      return;
    }

    setIsCreatingLabel(true);
    apiFetch<Label>("/api/labels", {
      data: {
        name: trimmedName
      }
    })
      .then(l => {
        setSearchedLabels([l, ...searchedLabels]);
        addLabel(l);
      })
      .catch((err: ApiError<FormErrors | any>) => {
        console.error("Failed to create label:", err);
        err.data.violations?.forEach((v: { title: string }) => {
          toast.error(v.title);
        })
      })
      .finally(() => setIsCreatingLabel(false));
  }

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
                            "flex-1 pl-3 text-left font-normal",
                            !watchedDueAt && "text-muted-foreground"
                          )}
                        >
                          {watchedDueAt ? (
                            format(watchedDueAt, "PPP")
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
                    const user = teamMembers.find((u) => u.id === userId);
                    if (!user) return null;

                    return (
                      <Badge
                        key={userId}
                        variant="secondary"
                        className="flex items-center gap-1"
                        onClick={() => console.log(userId)}
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
                        <div onClick={() => removeAssignee(userId)}>
                          <X
                            className="w-3 h-3 cursor-pointer"
                          />
                        </div>
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
                      {teamMembers
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
                    const label = labels.find((l) => l.id === labelId);
                    if (!label) return null;

                    return (
                      <Badge
                        key={labelId}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <span>{label.name}</span>
                        <div onClick={() => removeLabel(labelId)}>
                          <X
                            className="w-3 h-3 cursor-pointer"
                          />
                        </div>
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Add Labels */}
              <Popover
                onOpenChange={(open) => {
                  setIsLabelModalOpen(open);
                  !open && setLabelSearchValue("");
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2"/>
                    Add Label
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search or create labels..."
                      value={labelSearchValue}
                      onValueChange={setLabelSearchValue}
                    />

                    {/* Show loading state when searching */}
                    {isSearchingLabels && (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="w-4 h-4 animate-spin mr-2"/>
                        <span className="text-sm text-muted-foreground">
                            {labelSearchValue
                              ? "Searching labels..."
                              : "Loading labels..."}
                          </span>
                      </div>
                    )}

                    {!isSearchingLabels &&
                      (labelSearchValue.length === 0 ||
                        labelSearchValue.length >= 2) && (
                        <>
                          <CommandEmpty>
                            {labelSearchValue.trim() && (
                              <div className="p-2">
                                <CommandItem
                                  onSelect={() =>
                                    createLabel(labelSearchValue)
                                  }
                                  className="cursor-pointer"
                                  disabled={isCreatingLabel}
                                >
                                  {isCreatingLabel ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                                  ) : (
                                    <Tag className="w-4 h-4 mr-2"/>
                                  )}
                                  <span>Create "{labelSearchValue.trim()}"</span>
                                </CommandItem>
                              </div>
                            )}
                          </CommandEmpty>
                          <CommandGroup>
                            {/* Show "Create new" option even when there are existing labels */}
                            {labelSearchValue.trim() &&
                              !searchedLabels.some(
                                (label) =>
                                  label.name.toLowerCase() ===
                                  labelSearchValue.toLowerCase().trim()
                              ) && (
                                <CommandItem
                                  onSelect={() =>
                                    createLabel(labelSearchValue)
                                  }
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

                            {searchedLabels
                              .filter(
                                (label) => !watchedLabelIds.includes(label.id)
                              )
                              .map((label) => (
                                <CommandItem
                                  key={label.id}
                                  onSelect={() => addLabel(label)}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full mr-2"
                                    style={{
                                      backgroundColor: getLabelColor(label.name)
                                    }}
                                  />
                                  <span>{label.name}</span>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </>
                      )}
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
