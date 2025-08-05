import {Button} from "@/components/ui/button.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar.tsx";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.tsx";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Circle,
  Clock,
  Flag,
  MessageSquare,
  MoreHorizontal,
  Paperclip
} from "lucide-react";
import type {Task} from "@/types.ts";

interface TaskCardProps {
  task: Task;
}

export function TaskCard({task}: TaskCardProps) {
  const isOverdue = new Date(task.dueAt) < new Date() && task.relatedColumn.name !== "Done";

  const getPriorityIcon = (priority: Task["priority"]) => {
    switch (priority) {
      case "urgent":
        return <AlertCircle className="w-4 h-4 text-red-500"/>;
      case "high":
        return <Flag className="w-4 h-4 text-orange-500"/>;
      case "medium":
        return <Circle className="w-4 h-4 text-yellow-500"/>;
      case "low":
        return <CheckCircle className="w-4 h-4 text-green-500"/>;
    }
  };

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
    }
  };

  const getLabelColor = (labelName: string) => {
    const colors = {
      "Frontend": "bg-blue-100 text-blue-800",
      "Backend": "bg-purple-100 text-purple-800",
      "Bug": "bg-red-100 text-red-800",
      "Feature": "bg-green-100 text-green-800",
      "Design": "bg-pink-100 text-pink-800",
      "Testing": "bg-indigo-100 text-indigo-800",
    };
    return colors[labelName as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <Card className="mb-2 sm:mb-3 cursor-pointer hover:shadow-md transition-shadow bg-card">
      <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1 sm:gap-2">
            {getPriorityIcon(task.priority)}
            <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
              <span className="hidden sm:inline">{task.priority}</span>
              <span className="sm:hidden">{task.priority.charAt(0).toUpperCase()}</span>
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 sm:h-6 sm:w-6 p-0">
                <MoreHorizontal className="w-3 h-3 sm:w-4 sm:h-4"/>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem>Move to...</DropdownMenuItem>
              <DropdownMenuItem>Assign to...</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardTitle className="text-xs sm:text-sm font-medium leading-tight">
          {task.name}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6">
        {/* Labels */}
        <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
          {task.labels.map((label) => (
            <Badge
              key={label.id}
              variant="secondary"
              className={`text-xs px-1 sm:px-2 py-0 ${getLabelColor(label.name)}`}
            >
              {label.name}
            </Badge>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3"/>
              <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                {new Date(task.dueAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
              {isOverdue && <Clock className="w-3 h-3 text-red-600"/>}
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <MessageSquare className="w-3 h-3"/>
              <span>3</span>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <Paperclip className="w-3 h-3"/>
              <span>2</span>
            </div>
          </div>

          {/* Assignees */}
          <div className="flex -space-x-1">
            {task.assignees.slice(0, 2).map((assignee) => (
              <Avatar key={assignee.id} className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-background">
                <AvatarImage src="" alt={assignee.name}/>
                <AvatarFallback className="text-xs">
                  {assignee.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
            ))}
            {task.assignees.length > 2 && (
              <div
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                +{task.assignees.length - 2}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
