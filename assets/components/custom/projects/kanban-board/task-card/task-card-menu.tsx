import {Loader2, MoreHorizontal, Trash2} from "lucide-react";
import {memo} from "react";
import {Button} from "@/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from "@/components/ui/dropdown-menu";
import type {TaskCardProps} from "./task-card";
import {useApiFetch} from "@/hooks/use-api-fetch.ts";
import {toast} from "sonner";
import {confirmAction} from "@/components/custom/confirm-action-modal.tsx";

export const TaskCardMenu = memo(
  ({task, columns, currentColumn}: TaskCardProps) => {
    const {pending: deleting, action: deleteTask} = useApiFetch({
      url: `/api/tasks/${task.id}`,
      options: {
        method: "DELETE",
        onSuccess() {
          document.dispatchEvent(new CustomEvent("task.deleted", {detail: {id: task.id}}))
        },
        onError() {
          toast.error("An error occurred when deleting the task.")
        }
      }
    })

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
                    onClick={
                      () => document.dispatchEvent(
                        new CustomEvent(
                          "task.move", {
                            detail: {
                              columnId: c.id,
                              task,
                              score: Math.max(...c.tasks.map(t => t.score)) + 1000
                            }
                          }
                        )
                      )
                    }
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
            onClick={async () => {
              confirmAction({
                action: deleteTask,
                title: "Delete Task",
                description: "Are you really sure you want to delete this task? This action cannot be undone.",
              })
            }}
          >
            {deleting ? (
              <>
                <Loader2 className="animate-spin size-4"/>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="text-destructive-foregroun size-4"/>
                Delete
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);
