import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import type {
  ProjectColumnDetails,
  ProjectDetails,
  ProjectTaskDetails,
} from "@/api";
import { cn } from "@/lib/utils";
import { cellDndId } from "../../use-drag-n-drop";
import { TaskCard } from "../task-card";

type Props = {
  column: ProjectColumnDetails;
  tasks: ProjectTaskDetails[];
  project: ProjectDetails;
  /** Which swimlane this cell belongs to; `ALL_LANES` on an unsplit board. */
  laneKey: string;
  dragDisabled: boolean;
  className?: string;
  emptyLabel?: string;
};

/**
 * One (column, lane) cell — the drop target, and the unit the drag hook keys its order by.
 *
 * Split out of `ProjectColumn` so a swimlane row can render the same cell under a column header
 * that is drawn once at the top. Both layouts therefore share one droppable and one card list;
 * a second copy would be a second opinion about what a drop means.
 */
export function ColumnCell({
  column,
  tasks,
  project,
  laneKey,
  dragDisabled,
  className,
  emptyLabel = "Drop tasks here",
}: Props) {
  const { ref, isDropTarget } = useDroppable({
    id: cellDndId(column.id, laneKey),
    type: "column",
    accept: ["task"],
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 p-2 rounded-xl border-2 border-dashed transition-colors duration-150",
        isDropTarget
          ? "border-primary/50 bg-primary/5"
          : "border-transparent hover:border-muted-foreground/20",
        className,
      )}
    >
      {tasks.map((task, idx) => (
        <TaskCard
          index={idx}
          project={project}
          key={task.id}
          task={task}
          columnId={column.id}
          laneKey={laneKey}
          dragDisabled={dragDisabled}
        />
      ))}

      {tasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground/50 text-center">
            {isDropTarget ? "Release to drop task" : emptyLabel}
          </p>
        </div>
      )}
    </div>
  );
}
