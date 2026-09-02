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
  IconX,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import type { Dispatch, SetStateAction } from "react";
import type { ProjectDetails, ProjectTaskPriority } from "@/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { requestColumnCreate } from "./column-dialog";
import {
  type DueBucket,
  type GroupByField,
  hasActiveFilters,
  type SortField,
  type ToolbarState,
} from "./toolbar-filters";

type Props = {
  project: ProjectDetails;
  view: "board" | "table";
  state: ToolbarState;
  onStateChange: Dispatch<SetStateAction<ToolbarState>>;
};

const PRIORITY_OPTIONS: { value: ProjectTaskPriority; label: string }[] = [
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const DUE_BUCKET_OPTIONS: { value: DueBucket; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due this week" },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "dueDate", label: "Due date" },
  { value: "createdAt", label: "Created date" },
  { value: "score", label: "Score" },
  { value: "name", label: "Name" },
];

const GROUP_BY_OPTIONS: { value: GroupByField; label: string }[] = [
  { value: "column", label: "Column" },
  { value: "priority", label: "Priority" },
  { value: "assignee", label: "Assignee" },
  { value: "dueDate", label: "Due date" },
];

// Keep the checkbox menu open across clicks so several filters can be toggled at once.
const keepOpen = (e: Event) => e.preventDefault();

export function KanbanToolbar({ project, view, state, onStateChange }: Props) {
  const navigate = useNavigate();
  const maxScore = Math.max(0, ...project.columns.map((c) => Number(c.score)));
  const filtersActive = hasActiveFilters(state);

  const togglePriority = (priority: ProjectTaskPriority) =>
    onStateChange((s) => {
      const next = new Set(s.priorities);
      next.has(priority) ? next.delete(priority) : next.add(priority);
      return { ...s, priorities: next };
    });

  const toggleDueBucket = (bucket: DueBucket) =>
    onStateChange((s) => {
      const next = new Set(s.dueBuckets);
      next.has(bucket) ? next.delete(bucket) : next.add(bucket);
      return { ...s, dueBuckets: next };
    });

  const toggleAssignee = (userId: string) =>
    onStateChange((s) => {
      const next = new Set(s.assigneeIds);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return { ...s, assigneeIds: next };
    });

  const clearFilters = () =>
    onStateChange((s) => ({
      ...s,
      priorities: new Set(),
      dueBuckets: new Set(),
      assigneeIds: new Set(),
    }));

  const setSort = (field: SortField) =>
    onStateChange((s) => ({ ...s, sort: s.sort === field ? null : field }));

  const setGroupBy = (field: GroupByField) =>
    onStateChange((s) => ({ ...s, groupBy: field }));

  return (
    <div className="border-b bg-background shrink-0">
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
        {/* Search */}
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={state.search}
            onChange={(e) =>
              onStateChange((s) => ({ ...s, search: e.target.value }))
            }
            placeholder="Search tasks..."
            className="pl-8 h-8 text-sm bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-input"
          />
        </div>

        <Separator orientation="vertical" className="h-5 shrink-0" />

        {/* Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={filtersActive ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              <IconAdjustments className="size-3.5" />
              <span className="text-xs">Filter</span>
              <IconChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Priority
            </DropdownMenuLabel>
            {PRIORITY_OPTIONS.map((p) => (
              <DropdownMenuCheckboxItem
                key={p.value}
                checked={state.priorities.has(p.value)}
                onSelect={keepOpen}
                onCheckedChange={() => togglePriority(p.value)}
              >
                {p.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Due date
            </DropdownMenuLabel>
            {DUE_BUCKET_OPTIONS.map((d) => (
              <DropdownMenuCheckboxItem
                key={d.value}
                checked={state.dueBuckets.has(d.value)}
                onSelect={keepOpen}
                onCheckedChange={() => toggleDueBucket(d.value)}
              >
                {d.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Assignee
            </DropdownMenuLabel>
            {project.participants.map((p) => (
              <DropdownMenuCheckboxItem
                key={String(p.userId)}
                checked={state.assigneeIds.has(String(p.userId))}
                onSelect={keepOpen}
                onCheckedChange={() => toggleAssignee(String(p.userId))}
              >
                {p.name}
              </DropdownMenuCheckboxItem>
            ))}
            {filtersActive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters} className="gap-2">
                  <IconX className="size-3.5" />
                  Clear filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={state.sort ? "secondary" : "ghost"}
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
            {SORT_OPTIONS.map((s) => (
              <DropdownMenuCheckboxItem
                key={s.value}
                checked={state.sort === s.value}
                onCheckedChange={() => setSort(s.value)}
              >
                {s.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-5 shrink-0" />

        {/* Group by */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={state.groupBy !== "column" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              <IconLayoutColumns className="size-3.5" />
              <span className="text-xs hidden sm:inline">Group by</span>
              <IconChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Group by
            </DropdownMenuLabel>
            {GROUP_BY_OPTIONS.map((g) => (
              <DropdownMenuCheckboxItem
                key={g.value}
                checked={state.groupBy === g.value}
                onCheckedChange={() => setGroupBy(g.value)}
              >
                {g.label}
              </DropdownMenuCheckboxItem>
            ))}
            {view === "board" && state.groupBy !== "column" && (
              <p className="px-2 pt-1.5 text-[11px] text-muted-foreground/70">
                Only applied in table view — the board always groups by column.
              </p>
            )}
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
              onClick={() =>
                navigate({
                  to: "/projects/$projectId",
                  params: {
                    projectId: project.id.toString(),
                  },
                  search: { view: "board" },
                })
              }
              title="Board view"
            >
              <IconLayoutBoard className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 w-7 p-0 ${view === "table" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() =>
                navigate({
                  to: "/projects/$projectId",
                  params: {
                    projectId: project.id.toString(),
                  },
                  search: { view: "table" },
                })
              }
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
            onClick={() => requestColumnCreate(maxScore + 1000)}
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
