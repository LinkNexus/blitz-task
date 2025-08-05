import {Button} from "@/components/ui/button.tsx";
import {Plus, User} from "lucide-react";

interface BoardHeaderProps {
  onAddTask?: () => void;
  onFilter?: () => void;
}

export function BoardHeader({onAddTask, onFilter}: BoardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Issues Board</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage and track your team's tasks across different stages.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="sm:size-default" onClick={onFilter}>
          <User className="w-4 h-4 sm:mr-2"/>
          <span className="hidden sm:inline">Filter</span>
        </Button>
        <Button size="sm" className="sm:size-default" onClick={onAddTask}>
          <Plus className="w-4 h-4 sm:mr-2"/>
          <span className="hidden sm:inline">Add Task</span>
        </Button>
      </div>
    </div>
  );
}
