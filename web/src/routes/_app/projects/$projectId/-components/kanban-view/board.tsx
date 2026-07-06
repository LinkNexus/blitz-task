import { DragDropProvider } from "@dnd-kit/react";
import type { ProjectDetails } from "@/api";
import type { DndReturnValue } from "../use-drag-n-drop";
import { ProjectColumn } from "./column";

type Props = {
  project: ProjectDetails;
  dndProps: DndReturnValue;
};

export function KanbanBoard({ project, dndProps }: Props) {
  const sortedColumns = [...dndProps.effectiveColumns].sort(
    (a, b) => Number(a.score) - Number(b.score),
  );

  return (
    <DragDropProvider
      onDragStart={dndProps.handleDragStart}
      onDragOver={dndProps.handleDragOver}
      onDragEnd={dndProps.handleDragEnd}
    >
      <div className="flex gap-3 sm:gap-6 min-h-[500px] sm:min-h-[600px]">
        {sortedColumns.map((column) => (
          <ProjectColumn key={column.id} column={column} project={project} />
        ))}
      </div>
    </DragDropProvider>
  );
}
