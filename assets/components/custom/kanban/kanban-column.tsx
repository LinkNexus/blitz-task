import {Button} from "@/components/ui/button.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.tsx";
import {MoreHorizontal, Plus} from "lucide-react";
import type {Task, TaskColumn} from "@/types.ts";
import {TaskCard} from "./task-card.tsx";
import {useDroppable} from '@dnd-kit/core';

interface KanbanColumnProps {
  column: TaskColumn;
  tasks: Task[];
}

export function KanbanColumn({
  column, 
  tasks
}: KanbanColumnProps) {
  const {
    setNodeRef,
    isOver,
  } = useDroppable({
    id: `column-${column.id}`,
    data: {
      type: 'column',
      column,
    },
  });
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
            <Button variant="ghost" size="sm" className="h-5 w-5 sm:h-6 sm:w-6 p-0">
              <MoreHorizontal className="w-3 h-3 sm:w-4 sm:h-4"/>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Plus className="w-4 h-4 mr-2"/>
              Add task
            </DropdownMenuItem>
            <DropdownMenuItem>Edit column</DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">Delete column</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Column Tasks */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 sm:space-y-3 min-h-[400px] sm:min-h-[500px] p-1 sm:p-2 rounded-lg border-2 border-dashed transition-colors ${
          isOver 
            ? 'border-primary bg-primary/10' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
      >
        {tasks.map((task) => (
          <TaskCard 
            key={task.id} 
            task={task} 
          />
        ))}

        {/* Add task button in column */}
        <Button
          variant="ghost"
          className="w-full h-10 sm:h-12 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors text-xs sm:text-sm"
        >
          <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2"/>
          Add task
        </Button>
      </div>
    </div>
  );
}
