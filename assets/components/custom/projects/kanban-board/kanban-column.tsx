import {useDroppable} from "@dnd-kit/core";
import {SortableContext, verticalListSortingStrategy,} from "@dnd-kit/sortable";
import {Edit, MoreHorizontal, Plus, Trash} from "lucide-react";
import {memo, useMemo} from "react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from "@/components/ui/dropdown-menu";
import type {TaskColumn} from "@/types";
import {TaskCard} from "./task-card/task-card";

type Props = {
  column: TaskColumn;
  columns: TaskColumn[];
};

export const KanbanColumn = memo(({column, columns}: Props) => {
  const sortedTasks = useMemo(
    () => [...column.tasks].sort((a, b) => b.score - a.score),
    [column.tasks],
  );

  const {setNodeRef, isOver} = useDroppable({
    id: `column-${column.id}`,
    data: {
      type: "column",
      column,
    },
  });

  const taskIds = useMemo(
    () => sortedTasks.map((task) => task.id),
    [sortedTasks],
  );

  return (
    <div className="flex flex-col min-w-[280px] sm:min-w-[320px] w-[280px] sm:w-[320px] flex-shrink-0">
      <div className="flex items-center justify-between mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-1 sm:gap-2">
          <h3 className="font-semibold text-xs sm:text-sm truncate max-w-[150px] sm:max-w-[180px]">{column.name}</h3>
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {column.tasks.length}
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 flex-shrink-0"
            >
              <MoreHorizontal className="size-4"/>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <DropdownMenuItem>
                  <Plus className="size-4 mr-2"/>
                  Add column
                </DropdownMenuItem>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                {["Before", "After"].map((i) => (
                  <DropdownMenuItem key={i} onClick={() => console.log({i})}>
                    {i}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenuItem onClick={() => console.log("Edit column")}>
              <Edit className="w-4 h-4 mr-2"/>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => console.log("Delete column")}
            >
              <Trash className="w-4 h-4 mr-2 text-red-600"/>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 sm:space-y-3 min-h-[400px] sm:min-h-[500px] p-2 rounded-lg border-2 border-dashed transition-colors ${
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
              columns={columns}
              currentColumn={column}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
});
