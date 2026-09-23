import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import type { ProjectDetails } from "@/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BoardLane } from "../use-drag-n-drop";
import { ColumnCell } from "./column/cell";
import { ColumnHeader } from "./column/header";

type Props = {
  project: ProjectDetails;
  lanes: BoardLane[];
  dragDisabled: boolean;
};

const COLUMN_WIDTH = "min-w-[272px] w-[272px] shrink-0";

/**
 * The board as a Section x Column grid (L40.5 step 2).
 *
 * Column headers are drawn once along the top and each lane is a row of cells beneath them, so a
 * column reads as a column across the whole board rather than being repeated per lane. The cells
 * are the same `ColumnCell` the ordinary board uses, which is what makes a drop mean the same
 * thing in both layouts — and why dropping into another lane reassigns the task's section: the
 * cell it landed in names the lane.
 */
export function Swimlanes({ project, lanes, dragDisabled }: Props) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Lane order and column order both come from the hook; the counts are read off the same cells
  // that render, so a header can never disagree with what is under it.
  const columns = lanes[0]?.columns ?? [];

  return (
    <div className="min-w-fit">
      {/* Column headers, once for the whole grid. */}
      <div className="flex gap-3 sm:gap-6 mb-2">
        {columns.map((column, index) => (
          <ColumnHeader
            key={column.id}
            column={column}
            project={project}
            index={index}
            count={lanes.reduce(
              (total, lane) =>
                total +
                (lane.columns.find((c) => c.id === column.id)?.tasks.length ??
                  0),
              0,
            )}
            className={COLUMN_WIDTH}
          />
        ))}
      </div>

      {lanes.map((lane) => {
        const count = lane.columns.reduce((n, c) => n + c.tasks.length, 0);
        const isCollapsed = collapsed.has(lane.key);

        return (
          <div key={lane.key} className="mb-4">
            <button
              type="button"
              onClick={() => toggle(lane.key)}
              className="flex items-center gap-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {isCollapsed ? (
                <IconChevronRight className="size-4" />
              ) : (
                <IconChevronDown className="size-4" />
              )}
              {lane.color && (
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: lane.color }}
                />
              )}
              <span className="truncate">{lane.label}</span>
              <Badge
                variant="secondary"
                className="text-xs h-5 px-1.5 font-normal tabular-nums"
              >
                {count}
              </Badge>
            </button>

            {/* Collapsed lanes are unmounted rather than hidden: their cells are drop targets,
                and a hidden one would still accept a drop the user cannot see. */}
            {!isCollapsed && (
              <div className="flex gap-3 sm:gap-6">
                {lane.columns.map((column) => (
                  <ColumnCell
                    key={column.id}
                    column={column}
                    tasks={column.tasks}
                    project={project}
                    laneKey={lane.key}
                    dragDisabled={dragDisabled}
                    className={cn(COLUMN_WIDTH, "min-h-[120px]")}
                    emptyLabel=""
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
