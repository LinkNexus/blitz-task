import {useDroppable} from "@dnd-kit/core";
import {SortableContext, verticalListSortingStrategy,} from "@dnd-kit/sortable";
import {Loader2, MoreHorizontal, Plus, Trash} from "lucide-react";
import {
  Activity,
  memo,
  type ReactEventHandler,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState
} from "react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from "@/components/ui/dropdown-menu";
import type {TaskColumn} from "@/types";
import {TaskCard} from "./task-card/task-card";
import {toast} from "sonner";
import {apiFetch} from "@/lib/api-fetch.ts";
import {useApiFetch} from "@/hooks/use-api-fetch.ts";
import {confirmAction} from "@/components/custom/confirm-action-modal.tsx";

type Props = {
  projectId: number;
  column: TaskColumn;
  sortedColumns: TaskColumn[];
};

export const KanbanColumn = memo(({column, sortedColumns, projectId}: Props) => {
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

  const columnIndex = useMemo(
    () => sortedColumns.findIndex(c => c.id === column.id),
    [sortedColumns, column.id]
  );

  const [isEditing, setIsEditing] = useState(false);
  const oldNameRef = useRef(column.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const onColumnNameEmpty = useEffectEvent((trimmedColumnName: string) => {
    if (!trimmedColumnName) {
      setIsEditing(true);
    }
  })

  useEffect(() => {
    const trimmedContent = column.name.trim();

    if (!trimmedContent) {
      onColumnNameEmpty(trimmedContent);
      return;
    }

    const requestData: { name: string, score?: number; } = {
      name: trimmedContent,
      score: column.isNotPersisted ? column.score : undefined
    };

    if (column.name !== oldNameRef.current) {
      apiFetch(column.isNotPersisted ? `/api/columns?projectId=${projectId}` : `/api/columns/${column.id}`, {
        data: requestData
      })
        .then(res => {
          if (column.isNotPersisted) {
            console.log(res.data);
            document.dispatchEvent(new CustomEvent("column.created", {detail: res.data}));
          }
        })
        .catch(() => {
          toast.error(`An error occurred when ${column.isNotPersisted ? "creating" : "updating"} the column ${oldNameRef.current}`);
          document.dispatchEvent(new CustomEvent("column.renamed", {
            detail: {
              id: column.id,
              newName: oldNameRef.current
            }
          }))
        })
    }
  }, [column.name, projectId]);

  const handleChange: ReactEventHandler<HTMLInputElement> = useCallback(function (e) {
    const value = e.currentTarget.value.trim();

    if (!value) {
      toast.warning("The name of the column cannot be empty")
      document.dispatchEvent(new CustomEvent("column.deleted", {detail: {id: column.id}}));
    }

    setIsEditing(false);

    if (value !== column.name) {
      oldNameRef.current = column.name;
      document.dispatchEvent(new CustomEvent("column.renamed", {detail: {id: column.id, newName: value}}));
    }
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      console.log(isEditing, inputRef.current);
      inputRef.current.focus();
    }
  }, [isEditing]);

  const {pending: isDeleting, action: deleteColumn} = useApiFetch({
    url: `/api/columns/${column.id}`,
    options: {
      method: "DELETE",
      onSuccess() {
        document.dispatchEvent(new CustomEvent("column.deleted", {detail: {id: column.id}}));
      },
      onError() {
        toast.error(`An error happened when trying to delete column ${column.name}`);
      }
    }
  })

  return (
    <div className="flex flex-col min-w-[280px] sm:min-w-[320px] w-[280px] sm:w-[320px] flex-shrink-0">
      <div className="flex items-center justify-between mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-1 sm:gap-2">
          <Activity mode={isEditing ? "visible" : "hidden"}>
            <input
              ref={inputRef}
              defaultValue={column.name}
              className="border-none"
              autoFocus
              onBlur={handleChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleChange(e)
              }}
            />
          </Activity>
          <Activity mode={isEditing ? "hidden" : "visible"}>
            <h3
              onClick={() => {
                setIsEditing(true)
              }}
              className="font-semibold text-xs sm:text-sm truncate max-w-[150px] sm:max-w-[180px]"
            >
              {column.name}
            </h3>
          </Activity>
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
                  <DropdownMenuItem
                    key={i}
                    onClick={() => {
                      if (columnIndex < 0) return;
                      if (sortedColumns.some(c => c.isNotPersisted)) {
                        toast.info("You must first finish creating the current column before adding a new one.");
                        return;
                      }

                      function findScore(): number {
                        if (i === "Before") {
                          if (columnIndex === 0)
                            return sortedColumns[0].score - 1000;
                          return Math.floor((sortedColumns[columnIndex].score + sortedColumns[columnIndex - 1].score) / 2);
                        }

                        if (columnIndex === sortedColumns.length - 1)
                          return sortedColumns[sortedColumns.length - 1].score + 1000;
                        return Math.floor((sortedColumns[columnIndex].score + sortedColumns[columnIndex + 1].score) / 2);
                      }

                      document.dispatchEvent(new CustomEvent("column.create", {
                        detail: {
                          score: findScore()
                        }
                      }));
                    }}
                  >
                    {i}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => {
                confirmAction({
                  title: "Deleting Column",
                  description: "Are you sure you want to delete this column? All associated tasks will also be deleted and this action cannot be undone",
                  action: async () => await deleteColumn()
                })
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="animate-spin size-4"/>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash className="w-4 h-4 mr-2 text-red-600"/>
                  Delete
                </>
              )}
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
              columns={sortedColumns}
              currentColumn={column}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
});
