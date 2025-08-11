import {Badge} from "@/components/ui/badge.tsx";
import {Button} from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import type {Project, Task, TaskColumn} from "@/types.ts";
import {useDroppable} from "@dnd-kit/core";
import {SortableContext, verticalListSortingStrategy,} from "@dnd-kit/sortable";
import {Edit, MoreHorizontal, Plus, Trash} from "lucide-react";
import {TaskCard} from "./task-card.tsx";

interface KanbanColumnProps {
  project: Project;
  column: TaskColumn;
  tasks: Task[];
  onAddColumnBetween?: (afterColumnId: number) => void;
  onTaskEdit?: (task: Task) => void;
  onAddTask?: (columnId: number) => void; // Add task to specific column
}

export function KanbanColumn({
  project,
  column,
  tasks,
  onAddColumnBetween,
  onTaskEdit,
  onAddTask,
}: KanbanColumnProps) {
  const {setNodeRef, isOver} = useDroppable({
    id: `column-${column.id}`,
    data: {
      type: "column",
      column,
    },
  });

  // Sort tasks by their order within the column
  const sortedTasks = [...tasks].sort((a, b) => b.score - a.score);
  const taskIds = sortedTasks.map((task) => `task-${task.id}`);
  return (
    <div className="flex flex-col min-w-[280px] sm:min-w-[300px] flex-shrink-0">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-1 sm:gap-2">
          <div
            className="w-2 h-2 sm:w-3 sm:h-3 rounded-full"
            style={{backgroundColor: column.color}}
          />
          <h3 className="font-semibold text-xs sm:text-sm">{column.name}</h3>
          <Badge variant="secondary" className="text-xs">
            {tasks.length}
          </Badge>
        </div>
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
            <DropdownMenu>
              <DropdownMenuTrigger>
                <DropdownMenuItem>
                  <Plus className="w-4 h-4 mr-2"/>
                  Add column
                </DropdownMenuItem>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  // onClick={() => onAddColumnBetween?.(column.id)}
                >
                  Before
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onAddColumnBetween?.(column.id)}
                >
                  After
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenuItem>
              <Edit className="w-4 h-4 mr-2"/>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">
              <Trash className="w-4 h-4 mr-2 text-red-600"/>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Column Tasks */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 sm:space-y-3 min-h-[400px] sm:min-h-[500px] p-1 sm:p-2 rounded-lg border-2 border-dashed transition-colors ${
          isOver
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              project={project}
              onEdit={onTaskEdit}
            />
          ))}
        </SortableContext>

        {/* Add task button in column */}
        <Button
          variant="ghost"
          className="w-full h-10 sm:h-12 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors text-xs sm:text-sm"
          onClick={() => onAddTask?.(column.id)}
        >
          <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2"/>
          Add task
        </Button>
      </div>
    </div>
  );
}
