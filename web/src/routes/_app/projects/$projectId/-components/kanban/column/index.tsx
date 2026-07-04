import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import { IconPlus } from "@tabler/icons-react";
import { useMemo } from "react";
import type { ProjectColumnDetails, ProjectDetails } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskCard } from "../task-card";
import { ProjectColumnMenu } from "./menu";

type Props = {
  column: ProjectColumnDetails;
  project: ProjectDetails;
};

export function ProjectColumn({ column, project }: Props) {
  const sortedTasks = useMemo(
    () => [...column.tasks].sort((a, b) => Number(b.score) - Number(a.score)),
    [column.tasks],
  );

  const { ref, isDropTarget } = useDroppable({
    id: column.id,
    type: "column",
    accept: ["task", "column"],
    // collisionPriority: CollisionPriority.Low,
  });

  return (
    <div className="flex flex-col min-w-[272px] w-[272px] shrink-0">
      {/* Column header */}
      <div className="mb-2 rounded-xl bg-muted/50 border border-border/50 overflow-hidden">
        {/* Color accent line */}
        <div className="h-1 w-full" style={{ backgroundColor: column.color }} />
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-sm truncate">{column.name}</h3>
            <Badge
              variant="secondary"
              className="text-xs h-5 px-1.5 shrink-0 font-normal tabular-nums"
            >
              {sortedTasks.length}
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
        {sortedTasks.map((task, idx) => (
          <TaskCard index={idx} project={project} key={task.id} task={task} />
        ))}

        {/* Empty state */}
        {sortedTasks.length === 0 && !isDropTarget && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground/50 text-center">
              Drop tasks here
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
