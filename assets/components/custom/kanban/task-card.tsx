import {Avatar, AvatarFallback, AvatarImage,} from "@/components/ui/avatar.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardDescription, CardHeader, CardTitle,} from "@/components/ui/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import type {Project, Task, TaskColumn} from "@/types.ts";
import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Circle,
  Clock,
  Flag,
  GripVertical,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
} from "lucide-react";
import {useAppStore} from "@/lib/store.ts";
import {apiFetch} from "@/lib/fetch.ts";
import {toast} from "sonner";

interface TaskCardProps {
  task: Task;
  project: Project;
  onEdit?: (task: Task) => void; // Add optional edit handler
}

export function TaskCard({task, project, onEdit}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${task.id}`,
    data: {
      type: "task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const currentColumn = project.columns!
    .find(c => c.tasks.some(t => t.id === task.id))!;
  const maxColumnScore = Math.max(...currentColumn.tasks.map(t => t.score));

  const {
    moveTaskBetweenColumns,
    deleteTask
  } = useAppStore(state => state);

  function handleMove(toColumn: TaskColumn) {
    const newScore = toColumn.tasks.length > 0 ? Math.max(...toColumn.tasks.map(t => t.score)) + 100 : 100;

    moveTaskBetweenColumns(
      project.id,
      task.id,
      currentColumn.id,
      toColumn.id,
      newScore
    );

    apiFetch(`/api/tasks/move?projectId=${project.id}`, {
      data: {
        id: task.id,
        columnId: toColumn.id,
        score: newScore
      }
    }).then(() => {
      toast.success(`The task "${task.name}" was moved successfully to column "${toColumn.name}"`)
    })
      .catch(err => {
        console.log("An error occured when moving task: ", err);
        toast.error(`An error occurred when moving task "${task.name}" to "${toColumn.name}"`);
      })
  }

  function handleDelete() {
    deleteTask(task.id);
    apiFetch(`/api/tasks/${task.id}`, {
      method: "DELETE",
    })
      .then(() => {
        toast.success(`The task "${task.name}" was deleted successfully`);
      })
  }

  const isOverdue =
    task.dueAt !== null &&
    new Date(task.dueAt) < new Date() &&
    currentColumn.score !== maxColumnScore;

  const getPriorityIcon = (priority: Task["priority"]) => {
    switch (priority) {
      case "urgent":
        return <AlertCircle className="w-4 h-4 text-red-500"/>;
      case "high":
        return <Flag className="w-4 h-4 text-orange-500"/>;
      case "medium":
        return <Circle className="w-4 h-4 text-yellow-500"/>;
      case "low":
        return <CheckCircle className="w-4 h-4 text-green-500"/>;
    }
  };

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`mb-2 sm:mb-3 transition-all bg-card ${
        isDragging ? "opacity-50 shadow-lg z-50" : "hover:shadow-md"
      }`}
    >
      <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1 sm:gap-2">
            {getPriorityIcon(task.priority)}
            <Badge
              variant="outline"
              className={`text-xs ${getPriorityColor(task.priority)}`}
            >
              <span className="hidden sm:inline">{task.priority}</span>
              <span className="sm:hidden">
                {task.priority.charAt(0).toUpperCase()}
              </span>
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 sm:h-6 sm:w-6 p-0"
                >
                  <MoreHorizontal className="w-3 h-3 sm:w-4 sm:h-4"/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.(task)}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenu>
                  <DropdownMenuItem>
                    <DropdownMenuTrigger>
                      Move to...
                    </DropdownMenuTrigger>
                  </DropdownMenuItem>
                  <DropdownMenuContent>
                    {project.columns!.filter(c => c.id !== currentColumn.id).map(c => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => handleMove(c)}
                      >
                        <div
                          className="w-2 h-2 sm:w-3 sm:h-3 rounded-full"
                          style={{backgroundColor: c.color}}
                        />
                        {c.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={handleDelete}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Drag Handle */}
            <div
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted/50 rounded transition-colors"
              {...listeners}
              {...attributes}
            >
              <GripVertical className="w-3 h-3 text-muted-foreground"/>
            </div>
          </div>
        </div>
        <CardTitle className="text-xs sm:text-sm font-medium leading-tight">
          {task.name}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6">
        {/* Labels */}
        <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
          {task.labels.map((label) => (
            <Badge
              key={label.id}
              variant="secondary"
              className={`text-xs px-1 sm:px-2 py-0`}
            >
              {label.name}
            </Badge>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2 sm:gap-3">
            {task.dueAt !== null && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3"/>
                <span
                  className={`text-xs ${
                    isOverdue ? "text-red-600 font-medium" : ""
                  }`}
                >
                  {new Date(task.dueAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {isOverdue && <Clock className="w-3 h-3 text-red-600"/>}
              </div>
            )}
            <div className="hidden sm:flex items-center gap-1">
              <MessageSquare className="w-3 h-3"/>
              <span>3</span>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <Paperclip className="w-3 h-3"/>
              <span>2</span>
            </div>
          </div>

          {/* Assignees */}
          <div className="flex -space-x-1">
            {task.assignees.slice(0, 2).map((assignee) => (
              <Avatar
                key={assignee.id}
                className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-background"
              >
                <AvatarImage src="" alt={assignee.name}/>
                <AvatarFallback className="text-xs">
                  {assignee.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
            ))}
            {task.assignees.length > 2 && (
              <div
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                +{task.assignees.length - 2}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
