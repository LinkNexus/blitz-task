import {MoreHorizontal} from "lucide-react";
import {memo} from "react";
import {Button} from "@/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from "@/components/ui/dropdown-menu";
import type {TaskCardProps} from "./task-card";

export const TaskCardMenu = memo(
  ({task, columns, currentColumn}: TaskCardProps) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 sm:h-6 sm:w-6 p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-3 h-3 sm:w-4 sm:h-4"/>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent("task.update", {detail: task})
              )}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenu>
            <DropdownMenuItem>
              <DropdownMenuTrigger>Move to...</DropdownMenuTrigger>
            </DropdownMenuItem>
            <DropdownMenuContent>
              {columns
                .filter((c) => c.id !== currentColumn.id)
                .map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => console.log("Move to", c, "task", task)}
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
            onClick={() => console.log("Delete", task)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);
