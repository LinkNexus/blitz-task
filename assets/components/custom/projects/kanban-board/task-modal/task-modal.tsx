import {AssigneesField} from "@/components/custom/projects/kanban-board/task-modal/assignees-field.tsx";
import {TagsField} from "@/components/custom/projects/kanban-board/task-modal/tags-field.tsx";
import {DateTimePicker} from "@/components/forms/date-time-picker.tsx";
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
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select.tsx";
import {Textarea} from "@/components/ui/textarea.tsx";
import {type TaskForm, taskSchema} from "@/schemas.ts";
import type {FormErrors, Project, Task} from "@/types.ts";
import {zodResolver} from "@hookform/resolvers/zod";
import {memo, useCallback, useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import {useApiFetch} from "@/hooks/use-api-fetch.ts";
import {Button} from "@/components/ui/button.tsx";
import {setFormErrors} from "@/lib/forms.ts";
import {Loader2} from "lucide-react";

type Props = {
  participants: Project["participants"];
};

export const TaskModal = memo(({participants}: Props) => {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const isEditing = !!editingTask;

  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.addEventListener("task.create", () => {
      setEditingTask(null);
      setOpen(true);
    });

    document.addEventListener("task.update", (e) => {
      const task = (e as CustomEvent).detail;
      setEditingTask({...task});
      setOpen(true);
    });
  }, []);

  const resetForm = useCallback(() => {
    reset({
      name: "",
      description: undefined,
      priority: "medium",
      assigneesIds: [],
      labelsIds: [],
      dueAt: undefined
    });
  }, []);

  useEffect(() => {
    if (editingTask) {
      reset({
        name: editingTask.name,
        description: editingTask.description,
        priority: editingTask.priority,
        assigneesIds: editingTask.assignees.map(a => a.id),
        labelsIds: editingTask.tags.map(l => l.id),
        dueAt: editingTask.dueAt ? new Date(editingTask.dueAt) : undefined
      })
    } else {
      resetForm();
    }
  }, [editingTask]);

  const form = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    mode: "onBlur",
  });

  const {watch, setValue, reset} = form;

  const {pending, action: createOrUpdateTask} = useApiFetch<Task, FormErrors, TaskForm>({
    url: editingTask?.id ? `/api/tasks/${editingTask.id}` : "/api/tasks",
    options: {
      onSuccess(response) {
        document.dispatchEvent(
          new CustomEvent(
            editingTask?.id ? "task.updated" : "task.created",
            {detail: response.data}
          )
        );
        // setEditingTask(null);
        setOpen(false);
      },
      onError(err) {
        setFormErrors(form, err.response.data);
      },
    },
    deps: [editingTask?.id]
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Task" : "Create a new Task"}
          </DialogTitle>

          <DialogDescription>
            {isEditing
              ? "Update the task details below"
              : "Fill in the details below to create a new task"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(
              async (data) => await createOrUpdateTask({data})
            )}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="name"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Task Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className={"w-full"}>
                        <SelectValue placeholder={"Select an option"}/>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={"low"}>Low</SelectItem>
                        <SelectItem value={"medium"}>Medium</SelectItem>
                        <SelectItem value={"high"}>High</SelectItem>
                        <SelectItem value={"urgent"}>Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              render={({field}) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <DateTimePicker {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
              name={"dueAt"}
            />

            <AssigneesField
              onChange={(val) => setValue("assigneesIds", val)}
              watchedAssigneeIds={watch("assigneesIds")}
              participants={participants}
            />

            <TagsField
              onChange={(val) => setValue("labelsIds", val)}
              watchedLabelIds={watch("labelsIds")}
              labels={editingTask?.tags || []}
            />

            <DialogFooter>
              <Button
                onClick={() => {
                  resetForm();
                  setOpen(false);
                }}
                type="button" variant={"outline"}>
                Cancel
              </Button>
              <Button type="submit">
                {pending ? (
                  <>
                    <Loader2 className="animate-spin size-4"/>
                    {editingTask ? "Editing..." : "Creating..."}
                  </>
                ) : (
                  editingTask ? "Edit" : "Create"
                )
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
});
