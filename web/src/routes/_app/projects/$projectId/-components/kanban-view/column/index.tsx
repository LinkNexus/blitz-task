import { IconPlus } from "@tabler/icons-react";
import type {
  ProjectColumnDetails,
  ProjectDetails,
  ProjectTaskDetails,
} from "@/api";
import { Button } from "@/components/ui/button";
import { ALL_LANES } from "../../use-drag-n-drop";
import { ColumnCell } from "./cell";
import { ColumnHeader } from "./header";

type Props = {
  column: ProjectColumnDetails & { tasks: ProjectTaskDetails[] };
  project: ProjectDetails;
  index: number;
  dragDisabled: boolean;
};

/** A column on the ordinary board: its header over its single cell. */
export function ProjectColumn({ column, project, index, dragDisabled }: Props) {
  const tasks = column.tasks;

  return (
    <div className="flex flex-col min-w-[272px] w-[272px] shrink-0">
      <ColumnHeader
        column={column}
        project={project}
        index={index}
        count={tasks.length}
        className="mb-2"
      />

      <ColumnCell
        column={column}
        tasks={tasks}
        project={project}
        laneKey={ALL_LANES}
        dragDisabled={dragDisabled}
        className="flex-1 min-h-[480px]"
      />

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
