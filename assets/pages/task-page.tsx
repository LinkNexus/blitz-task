import {TaskAttachments} from "@/components/custom/kanban/tasks/view/task-attachments.tsx";
import {TaskComments} from "@/components/custom/kanban/tasks/view/task-comments.tsx";
import {TaskDetails} from "@/components/custom/kanban/tasks/view/task-details.tsx";
import {TaskHeader} from "@/components/custom/kanban/tasks/view/task-header.tsx";
import {TaskSidebar} from "@/components/custom/kanban/tasks/view/task-sidebar.tsx";
import {Button} from "@/components/ui/button.tsx";
import {apiFetch} from "@/lib/fetch.ts";
import type {Attachment, Comment, Task} from "@/types.ts";
import {ArrowLeft, Loader2} from "lucide-react";
import {useEffect, useState} from "react";
import {toast} from "sonner";
import {useAppStore} from "@/lib/store.ts";

interface TaskPageProps {
  taskId: number;
  onGoBack?: () => void;
}

export function TaskPage({taskId, onGoBack}: TaskPageProps) {
  const {teams} = useAppStore(state => state);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setError("Task ID is required");
      setLoading(false);
      return;
    }

    const existingTask = teams.flatMap(t => t.projects)
      .flatMap(p => p?.columns)
      .flatMap(c => c?.tasks)
      .find(t => t?.id === taskId);

    if (existingTask) {
      setTask(existingTask);
      setLoading(false);
    } else {
      fetchTask();
    }
  }, [taskId]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch<Task>(`/api/tasks/${taskId}`, {
        data: {
          include: "comments,attachments,assignees,labels"
        }
      });

      setTask(response);
    } catch (err) {
      console.error("Failed to fetch task:", err);
      setError("Failed to load task. Please try again.");
      toast.error("Failed to load task");
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTask(updatedTask);
  };

  const handleCommentAdd = (newComment: Comment) => {
    if (task) {
      setTask({
        ...task,
        comments: [...(task.comments || []), newComment]
      });
    }
  };

  const handleCommentUpdate = (updatedComment: Comment) => {
    if (task) {
      setTask({
        ...task,
        comments: task.comments?.map(comment =>
          comment.id === updatedComment.id ? updatedComment : comment
        ) || []
      });
    }
  };

  const handleCommentDelete = (commentId: number) => {
    if (task) {
      setTask({
        ...task,
        comments: task.comments?.filter(comment => comment.id !== commentId) || []
      });
    }
  };

  const handleAttachmentAdd = (newAttachment: Attachment) => {
    if (task) {
      setTask({
        ...task,
        attachments: [...(task.attachments || []), newAttachment]
      });
    }
  };

  const handleAttachmentDelete = (attachmentId: number) => {
    if (task) {
      setTask({
        ...task,
        attachments: task.attachments?.filter(attachment => attachment.id !== attachmentId) || []
      });
    }
  };

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else {
      // Fallback navigation if no onGoBack is provided
      window.history.back();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin"/>
          Loading task...
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">
            {error || "Task not found"}
          </h2>
          <p className="text-muted-foreground mb-4">
            The task you're looking for doesn't exist or couldn't be loaded.
          </p>
          <Button onClick={handleGoBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2"/>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header with back button */}
      <div className="mb-6">
        <TaskHeader
          task={task}
          onTaskUpdate={handleTaskUpdate}
        />
      </div>

      {/* Main content layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task details */}
          <TaskDetails
            task={task}
            onTaskUpdate={handleTaskUpdate}
          />

          {/* Attachments */}
          <TaskAttachments
            task={task}
            onAttachmentAdd={handleAttachmentAdd}
            onAttachmentDelete={handleAttachmentDelete}
          />

          {/* Comments */}
          <TaskComments
            task={task}
            onCommentAdd={handleCommentAdd}
            onCommentUpdate={handleCommentUpdate}
            onCommentDelete={handleCommentDelete}
          />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <TaskSidebar
            task={task}
            onTaskUpdate={handleTaskUpdate}
          />
        </div>
      </div>
    </div>
  );
}
