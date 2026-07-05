import {
  IconAdjustments,
  IconArrowsSort,
  IconChevronDown,
  IconCirclePlus,
  IconLayoutBoard,
  IconLayoutColumns,
  IconPlus,
  IconSearch,
  IconTable,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import type { ProjectDetails } from "@/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type Props = {
  project: ProjectDetails;
  view: "board" | "table";
};

export function KanbanToolbar({ project, view }: Props) {
  const navigate = useNavigate();
  return (
    <div className="border-b bg-background shrink-0">
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
        {/* Search */}
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search tasks..."
            className="pl-8 h-8 text-sm bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-input"
          />
        </div>

        <Separator orientation="vertical" className="h-5 shrink-0" />

        {/* Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              <IconAdjustments className="size-3.5" />
              <span className="text-xs">Filter</span>
              <IconChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Priority
            </DropdownMenuLabel>
            {["Urgent", "High", "Medium", "Low"].map((p) => (
              <DropdownMenuItem
                key={p}
                onClick={() => console.log("filter priority", p)}
              >
                {p}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Due date
            </DropdownMenuLabel>
            {["Overdue", "Due today", "Due this week"].map((d) => (
              <DropdownMenuItem
                key={d}
                onClick={() => console.log("filter due", d)}
              >
                {d}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Assignee
            </DropdownMenuLabel>
            {project.participants.slice(0, 4).map((p) => (
              <DropdownMenuItem
                key={String(p.userId)}
                onClick={() => console.log("filter assignee", p.userId)}
              >
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              <IconArrowsSort className="size-3.5" />
              <span className="text-xs">Sort</span>
              <IconChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Sort by
            </DropdownMenuLabel>
            {["Priority", "Due date", "Created date", "Score", "Name"].map(
              (s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => console.log("sort by", s)}
                >
                  {s}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-5 shrink-0" />

        {/* Group by */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              <IconLayoutColumns className="size-3.5" />
              <span className="text-xs hidden sm:inline">Group by</span>
              <IconChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Group by
            </DropdownMenuLabel>
            {["Column", "Priority", "Assignee", "Due date"].map((g) => (
              <DropdownMenuItem
                key={g}
                onClick={() => console.log("group by", g)}
              >
                {g}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Right-side actions */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 w-7 p-0 ${view === "board" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => navigate({ search: { view: "board" } })}
              title="Board view"
            >
              <IconLayoutBoard className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 w-7 p-0 ${view === "table" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => navigate({ search: { view: "table" } })}
              title="Table view"
            >
              <IconTable className="size-3.5" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-5" />

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => console.log("new column")}
          >
            <IconCirclePlus className="size-3.5" />
            <span className="hidden sm:inline">New Column</span>
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() =>
              document.dispatchEvent(new CustomEvent("task.create"))
            }
          >
            <IconPlus className="size-3.5" />
            New Task
          </Button>
        </div>
      </div>
    </div>
  );
}
