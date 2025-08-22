import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Calendar} from "@/components/ui/calendar.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Popover, PopoverContent, PopoverTrigger,} from "@/components/ui/popover.tsx";
import type {Label, User} from "@/types.ts";
import {Calendar as CalendarIcon, Flag, Plus, RotateCcw, Search, Tag, Users, X} from "lucide-react";
import {useState} from "react";

export interface BoardFilters {
  search: string;
  assignees: number[];
  labels: number[];
  priorities: ("low" | "medium" | "high" | "urgent")[];
  dueDateFrom?: Date;
  dueDateTo?: Date;
}

interface BoardHeaderProps {
  onAddTask?: () => void;
  filters: BoardFilters;
  onFiltersChange: (filters: BoardFilters) => void;
  availableUsers: Pick<User, "id" | "name">[];
  availableLabels: Label[];
  totalTasks?: number;
  filteredTasks?: number;
}

const priorityColors = {
  low: "bg-blue-100 text-blue-800 border-blue-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  urgent: "bg-red-100 text-red-800 border-red-200",
};

const priorityLabels = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function BoardHeader({
  onAddTask,
  filters,
  onFiltersChange,
  availableUsers,
  availableLabels,
  totalTasks = 0,
  filteredTasks = 0,
}: BoardHeaderProps) {
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const handleSearchChange = (value: string) => {
    onFiltersChange({...filters, search: value});
  };

  const handleAssigneeToggle = (userId: number) => {
    const newAssignees = filters.assignees.includes(userId)
      ? filters.assignees.filter(id => id !== userId)
      : [...filters.assignees, userId];
    onFiltersChange({...filters, assignees: newAssignees});
  };

  const handleLabelToggle = (labelId: number) => {
    const newLabels = filters.labels.includes(labelId)
      ? filters.labels.filter(id => id !== labelId)
      : [...filters.labels, labelId];
    onFiltersChange({...filters, labels: newLabels});
  };

  const handlePriorityToggle = (priority: "low" | "medium" | "high" | "urgent") => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter(p => p !== priority)
      : [...filters.priorities, priority];
    onFiltersChange({...filters, priorities: newPriorities});
  };

  const clearAllFilters = () => {
    onFiltersChange({
      search: "",
      assignees: [],
      labels: [],
      priorities: [],
      dueDateFrom: undefined,
      dueDateTo: undefined,
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.assignees.length > 0 ||
    filters.labels.length > 0 ||
    filters.priorities.length > 0 ||
    filters.dueDateFrom ||
    filters.dueDateTo;

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    filters.assignees.length +
    filters.labels.length +
    filters.priorities.length +
    (filters.dueDateFrom ? 1 : 0) +
    (filters.dueDateTo ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Issues Board</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage and track your team's tasks across different stages.
            {totalTasks > 0 && (
              <span className="ml-2">
                Showing {filteredTasks} of {totalTasks} tasks
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="sm:size-default" onClick={onAddTask}>
            <Plus className="w-4 h-4 sm:mr-2"/>
            <span className="hidden sm:inline">Add Task</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4"/>
          <Input
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-4"
          />
          {filters.search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSearchChange("")}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="w-3 h-3"/>
            </Button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex gap-2 flex-wrap">
          {/* Assignees Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Users className="w-4 h-4 mr-2"/>
                Assignees
                {filters.assignees.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {filters.assignees.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Filter by Assignee</DropdownMenuLabel>
              <DropdownMenuSeparator/>
              {availableUsers.map((user) => (
                <DropdownMenuCheckboxItem
                  key={user.id}
                  checked={filters.assignees.includes(user.id)}
                  onCheckedChange={() => handleAssigneeToggle(user.id)}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={`/avatars/${user.id}.jpg`}/>
                      <AvatarFallback className="text-xs">
                        {user.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{user.name}</span>
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Labels Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Tag className="w-4 h-4 mr-2"/>
                Labels
                {filters.labels.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {filters.labels.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuLabel>Filter by Label</DropdownMenuLabel>
              <DropdownMenuSeparator/>
              {availableLabels.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked={filters.labels.includes(label.id)}
                  onCheckedChange={() => handleLabelToggle(label.id)}
                >
                  {label.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Flag className="w-4 h-4 mr-2"/>
                Priority
                {filters.priorities.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {filters.priorities.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
              <DropdownMenuSeparator/>
              {(["urgent", "high", "medium", "low"] as const).map((priority) => (
                <DropdownMenuCheckboxItem
                  key={priority}
                  checked={filters.priorities.includes(priority)}
                  onCheckedChange={() => handlePriorityToggle(priority)}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${priorityColors[priority]}`}/>
                    {priorityLabels[priority]}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Due Date Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="w-4 h-4 mr-2"/>
                Due Date
                {(filters.dueDateFrom || filters.dueDateTo) && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    1
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80">
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">From Date</label>
                  <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="w-4 h-4 mr-2"/>
                        {filters.dueDateFrom?.toLocaleDateString() || "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.dueDateFrom}
                        onSelect={(date) => {
                          onFiltersChange({...filters, dueDateFrom: date});
                          setDateFromOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">To Date</label>
                  <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="w-4 h-4 mr-2"/>
                        {filters.dueDateTo?.toLocaleDateString() || "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.dueDateTo}
                        onSelect={(date) => {
                          onFiltersChange({...filters, dueDateTo: date});
                          setDateToOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {(filters.dueDateFrom || filters.dueDateTo) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onFiltersChange({...filters, dueDateFrom: undefined, dueDateTo: undefined})}
                    className="w-full"
                  >
                    Clear Dates
                  </Button>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear All Filters */}
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              <RotateCcw className="w-4 h-4 mr-2"/>
              Clear All
              <Badge variant="secondary" className="ml-2 text-xs">
                {activeFilterCount}
              </Badge>
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: "{filters.search}"
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSearchChange("")}
                className="h-auto p-0 ml-1 hover:bg-transparent"
              >
                <X className="w-3 h-3"/>
              </Button>
            </Badge>
          )}
          {filters.assignees.map((userId) => {
            const user = availableUsers.find(u => u.id === userId);
            return user ? (
              <Badge key={userId} variant="secondary" className="gap-1">
                <Avatar className="w-4 h-4">
                  <AvatarFallback className="text-xs">
                    {user.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                {user.name}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAssigneeToggle(userId)}
                  className="h-auto p-0 ml-1 hover:bg-transparent"
                >
                  <X className="w-3 h-3"/>
                </Button>
              </Badge>
            ) : null;
          })}
          {filters.labels.map((labelId) => {
            const label = availableLabels.find(l => l.id === labelId);
            return label ? (
              <Badge key={labelId} variant="secondary" className="gap-1">
                {label.name}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLabelToggle(labelId)}
                  className="h-auto p-0 ml-1 hover:bg-transparent"
                >
                  <X className="w-3 h-3"/>
                </Button>
              </Badge>
            ) : null;
          })}
          {filters.priorities.map((priority) => (
            <Badge key={priority} variant="secondary" className="gap-1">
              <div className={`w-2 h-2 rounded-full ${priorityColors[priority]}`}/>
              {priorityLabels[priority]}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePriorityToggle(priority)}
                className="h-auto p-0 ml-1 hover:bg-transparent"
              >
                <X className="w-3 h-3"/>
              </Button>
            </Badge>
          ))}
          {filters.dueDateFrom && (
            <Badge variant="secondary" className="gap-1">
              From: {filters.dueDateFrom.toLocaleDateString()}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFiltersChange({...filters, dueDateFrom: undefined})}
                className="h-auto p-0 ml-1 hover:bg-transparent"
              >
                <X className="w-3 h-3"/>
              </Button>
            </Badge>
          )}
          {filters.dueDateTo && (
            <Badge variant="secondary" className="gap-1">
              To: {filters.dueDateTo.toLocaleDateString()}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFiltersChange({...filters, dueDateTo: undefined})}
                className="h-auto p-0 ml-1 hover:bg-transparent"
              >
                <X className="w-3 h-3"/>
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
