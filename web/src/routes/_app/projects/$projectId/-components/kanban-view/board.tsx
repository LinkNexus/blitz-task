import { DragDropProvider } from "@dnd-kit/react";
import { IconPlus } from "@tabler/icons-react";
import type { ProjectDetails } from "@/api";
import { requestColumnCreate } from "../column-dialog";
import type { DndReturnValue } from "../use-drag-n-drop";
import { ProjectColumn } from "./column";

type Props = {
  project: ProjectDetails;
  dndProps: DndReturnValue;
};

export function KanbanBoard({ project, dndProps }: Props) {
  // effectiveColumns is already ordered by the dnd hook (score at rest, the
  // optimistic order mid-drag) — don't re-sort here or it cancels the drag.
  const columns = dndProps.effectiveColumns;
  const maxScore = Math.max(0, ...columns.map((c) => Number(c.score)));

  return (
    <DragDropProvider
      onDragStart={dndProps.handleDragStart}
      onDragOver={dndProps.handleDragOver}
      onDragEnd={dndProps.handleDragEnd}
    >
      <div className="flex gap-3 sm:gap-6 min-h-[500px] sm:min-h-[600px]">
        {columns.map((column, index) => (
          <ProjectColumn
            key={column.id}
            index={index}
            column={column}
            project={project}
          />
        ))}

        <button
          type="button"
          onClick={() => requestColumnCreate(maxScore + 1000)}
          className="flex min-w-[272px] w-[272px] shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <IconPlus className="size-4" />
          Add column
        </button>
      </div>
    </DragDropProvider>
  );
}
