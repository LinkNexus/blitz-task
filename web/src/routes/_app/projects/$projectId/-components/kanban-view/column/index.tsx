import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { IconGripVertical, IconPlus } from "@tabler/icons-react";
import type {
  ProjectColumnDetails,
  ProjectDetails,
  ProjectTaskDetails,
} from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { colDndId, colSortDndId, sortablePlugins } from "../../use-drag-n-drop";
import { TaskCard } from "../task-card";
import { ProjectColumnMenu } from "./menu";

type Props = {
  column: ProjectColumnDetails & { tasks: ProjectTaskDetails[] };
  project: ProjectDetails;
  index: number;
};

export function ProjectColumn({ column, project, index }: Props) {
  const tasks = column.tasks;

  const { ref, isDropTarget } = useDroppable({
    id: colDndId(column.id),
    type: "column",
    accept: ["task"],
    collisionPriority: CollisionPriority.Low,
  });

  const {
    ref: sortRef,
    handleRef,
    isDragging,
  } = useSortable({
    id: colSortDndId(column.id),
    index,
    type: "column",
    accept: "column",
    plugins: sortablePlugins,
  });

  return (
    <div
      ref={sortRef}
      className={cn(
        "flex flex-col min-w-[272px] w-[272px] shrink-0 transition-opacity",
        isDragging && "opacity-50",
      )}
    >
      {/* Column header (drag handle) */}
      <div className="mb-2 rounded-xl bg-muted/50 border border-border/50 overflow-hidden">
        {/* Color accent line */}
        <div className="h-1 w-full" style={{ backgroundColor: column.color }} />
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              ref={handleRef}
              className="shrink-0 -ml-1 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
              aria-label="Reorder column"
            >
              <IconGripVertical className="size-4" />
            </button>
            <h3 className="font-semibold text-sm truncate">{column.name}</h3>
            <Badge
              variant="secondary"
              className="text-xs h-5 px-1.5 shrink-0 font-normal tabular-nums"
            >
              {tasks.length}
            </Badge>
          </div>
          <ProjectColumnMenu column={column} projectId={Number(project.id)} />
        </div>
      </div>

      {/* Task drop zone */}
      <div
        ref={ref}
        className={cn(
          "flex-1 flex flex-col gap-2 min-h-[480px] p-2 rounded-xl border-2 border-dashed transition-colors duration-150",
          isDropTarget
            ? "border-primary/50 bg-primary/5"
            : "border-transparent hover:border-muted-foreground/20",
        )}
      >
        {tasks.map((task, idx) => (
          <TaskCard
            index={idx}
            project={project}
            key={task.id}
            task={task}
            columnId={column.id}
          />
        ))}

        {!isDropTarget && tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground/50 text-center">
              Drop tasks here
            </p>
          </div>
        )}

        {isDropTarget && tasks.length - 1 === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground/50 text-center">
              Release to drop task
            </p>
          </div>
        )}
      </div>

      {/* Add task CTA */}
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full justify-start gap-2 text-muted-foreground hover:text-foreground h-8 text-xs"
        onClick={() =>
          document.dispatchEvent(
            new CustomEvent("task.create", { detail: { columnId: column.id } }),
          )
        }
      >
        <IconPlus className="size-3.5" />
        Add task
      </Button>
    </div>
  );
}
