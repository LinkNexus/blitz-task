import { Button } from "@/components/ui/button.tsx";
import { TaskPage } from "@/pages/task-page.tsx";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

interface TaskViewModalProps {
  taskId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskViewModal({ taskId, isOpen, onClose }: TaskViewModalProps) {
  if (!isOpen || !taskId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-y-0 right-0 w-full max-w-7xl bg-background shadow-lg overflow-auto">
        <div className="sticky top-0 bg-background border-b p-4 z-10">
          <Button onClick={onClose} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Board
          </Button>
        </div>
        <div className="p-4">
          <TaskPage taskId={taskId} onGoBack={onClose} />
        </div>
      </div>
    </div>
  );
}

// Example usage hook that can be used in the kanban board
export function useTaskView() {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isTaskViewOpen, setIsTaskViewOpen] = useState(false);

  const openTaskView = (taskId: number) => {
    setSelectedTaskId(taskId);
    setIsTaskViewOpen(true);
  };

  const closeTaskView = () => {
    setSelectedTaskId(null);
    setIsTaskViewOpen(false);
  };

  return {
    selectedTaskId,
    isTaskViewOpen,
    openTaskView,
    closeTaskView,
    TaskViewModal: (props: Omit<TaskViewModalProps, 'taskId' | 'isOpen' | 'onClose'>) => (
      <TaskViewModal
        {...props}
        taskId={selectedTaskId}
        isOpen={isTaskViewOpen}
        onClose={closeTaskView}
      />
    ),
  };
}
