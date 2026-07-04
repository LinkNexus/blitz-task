import {
  IconArrowRight,
  IconDots,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import type { ProjectDetails, ProjectTaskDetails } from "@/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  task: ProjectTaskDetails;
  columns: ProjectDetails["columns"];
};

export function ProjectMenu({ task, columns }: Props) {
  const otherColumns = columns.filter(
    (c) => Number(c.id) !== Number(task.columnId),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <IconDots className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={() =>
            document.dispatchEvent(
              new CustomEvent("task.update", { detail: task }),
            )
          }
        >
          <IconEdit className="size-4" />
          Edit task
        </DropdownMenuItem>

        {otherColumns.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconArrowRight className="size-4" />
              Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {otherColumns.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => console.log("Move to", c.id, "task", task.id)}
                >
                  <div
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation();
            console.log("Delete task", task.id);
          }}
        >
          <IconTrash className="size-4" />
          Delete task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
