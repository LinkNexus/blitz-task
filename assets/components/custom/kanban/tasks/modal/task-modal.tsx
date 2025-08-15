import { Button } from "@/components/ui/button.tsx";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Form } from "@/components/ui/form.tsx";
import { useTaskForm } from "@/hooks/useTaskForm.ts";
import type { Task, TaskColumn, Team } from "@/types.ts";
import { Loader2 } from "lucide-react";
import { TaskAssigneeSection } from "./task-assignee-section.tsx";
import { TaskBasicForm } from "./task-basic-form.tsx";
import { TaskLabelSection } from "./task-label-section.tsx";

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
  const {
    form,
    labels,
    setLabels,
    isEditing,
    onSubmit,
    handleClose,
  } = useTaskForm({
    isOpen,
    task,
    columns,
    defaultColumnId,
    onClose,
  });

  const { formState: { isSubmitting } } = form;

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
          <form onSubmit={onSubmit} className="space-y-6">
            <TaskBasicForm form={form} columns={columns} />
            
            <TaskAssigneeSection form={form} teamMembers={teamMembers} />
            
            <TaskLabelSection form={form} labels={labels} setLabels={setLabels} />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Update Task" : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Keep the existing useTaskModal hook for compatibility
export { useTaskModal } from "@/hooks/useTaskModal.ts";
