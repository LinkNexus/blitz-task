import { apiFetch } from "@/lib/fetch.ts";
import { useAppStore } from "@/lib/store.ts";
import type { Label, Task, TaskColumn } from "@/types.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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

export type TaskFormData = z.infer<typeof taskSchema>;

interface UseTaskFormProps {
  isOpen: boolean;
  task?: Task | null;
  columns: TaskColumn[];
  defaultColumnId?: number;
  onClose: () => void;
}

export function useTaskForm({ isOpen, task, columns, defaultColumnId, onClose }: UseTaskFormProps) {
  const isEditing = !!task;
  const [labels, setLabels] = useState<Label[]>([]);

  const { addTask, updateTask } = useAppStore(state => state);
  
  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: task?.name || "",
      description: task?.description || "",
      priority: task?.priority || "medium",
      columnId: task
        ? columns.find((col) => col.tasks?.some((t) => t.id === task.id))?.id ||
          columns[0]?.id
        : defaultColumnId || columns[0]?.id,
      assigneeIds: task?.assignees?.map((a) => a.id) || [],
      labelIds: task?.labels?.map((l) => l.id) || [],
      dueAt: task?.dueAt ? new Date(task.dueAt) : undefined,
    },
  });

  const { handleSubmit, reset, setValue } = form;

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
        ? columns.find((col) => col.tasks?.some((t) => t.id === task.id))?.id ||
          columns[0]?.id
        : defaultColumnId || columns[0]?.id;

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
    onClose();
  }

  return {
    form,
    labels,
    setLabels,
    isEditing,
    onSubmit: handleSubmit(onSubmit),
    handleClose,
  };
}
