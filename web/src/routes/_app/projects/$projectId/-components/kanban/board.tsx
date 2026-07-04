import { DragDropProvider } from "@dnd-kit/react";
import type { ProjectDetails } from "@/api";
import { ProjectColumn } from "./column";
import { useDragNDrop } from "./hooks";

export function KanbanBoard({ project }: { project: ProjectDetails }) {
  const { effectiveColumns, handleDragStart, handleDragOver, handleDragEnd } =
    useDragNDrop(project);

  const sortedColumns = [...effectiveColumns].sort(
    (a, b) => Number(a.score) - Number(b.score),
  );

  return (
    <DragDropProvider
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 sm:gap-6 min-h-[500px] sm:min-h-[600px]">
        {sortedColumns.map((column) => (
          <ProjectColumn key={column.id} column={column} project={project} />
        ))}
      </div>
    </DragDropProvider>
  );
}
