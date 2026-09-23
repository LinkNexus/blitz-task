import { useSortable } from "@dnd-kit/react/sortable";
import { IconGripVertical } from "@tabler/icons-react";
import type { ProjectColumnDetails, ProjectDetails } from "@/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { colSortDndId, sortablePlugins } from "../../use-drag-n-drop";
import { ProjectColumnMenu } from "./menu";

type Props = {
  column: ProjectColumnDetails;
  project: ProjectDetails;
  index: number;
  /** Tasks in this column across every lane — the header counts the column, not one cell. */
  count: number;
  className?: string;
};

/**
 * A column's header, and the handle that reorders it.
 *
 * Drawn once per column in both layouts: above its own cell on the ordinary board, and once at
 * the top of the grid when the board is split into swimlanes. Keeping the sortable here is what
 * lets column reordering keep working in swimlane mode, where a column is no longer one
 * contiguous element.
 */
export function ColumnHeader({
  column,
  project,
  index,
  count,
  className,
}: Props) {
  const { ref, handleRef, isDragging } = useSortable({
    id: colSortDndId(column.id),
    index,
    type: "column",
    accept: "column",
    plugins: sortablePlugins,
  });

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl bg-muted/50 border border-border/50 overflow-hidden transition-opacity",
        isDragging && "opacity-50",
        className,
      )}
    >
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
            {count}
          </Badge>
        </div>
        <ProjectColumnMenu column={column} projectId={Number(project.id)} />
      </div>
    </div>
  );
}
