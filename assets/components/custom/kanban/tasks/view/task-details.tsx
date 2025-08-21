import {Badge} from "@/components/ui/badge.tsx";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Separator} from "@/components/ui/separator.tsx";
import type {Task} from "@/types.ts";
import {Calendar, Clock, Flag, Hash, Tag, User} from "lucide-react";
import {memo} from "react";

interface TaskDetailsProps {
  task: Task;
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

export const TaskDetails = memo(function ({task}: TaskDetailsProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="w-5 h-5"/>
          Task Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Priority */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Flag className="w-4 h-4"/>
            Priority
          </div>
          <Badge variant="outline" className={priorityColors[task.priority]}>
            {priorityLabels[task.priority]}
          </Badge>
        </div>

        <Separator/>

        {/* Due Date */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="w-4 h-4"/>
            Due Date
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(task.dueAt)}
          </p>
        </div>

        <Separator/>

        {/* Assignees */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User className="w-4 h-4"/>
            Assignees ({task.assignees.length})
          </div>
          {task.assignees.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {task.assignees.map((assignee) => (
                <Badge key={assignee.id} variant="secondary">
                  {assignee.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No assignees</p>
          )}
        </div>

        <Separator/>

        {/* Labels */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Tag className="w-4 h-4"/>
            Labels ({task.labels.length})
          </div>
          {task.labels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {task.labels.map((label) => (
                <Badge key={label.id} variant="outline">
                  {label.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No labels</p>
          )}
        </div>

        <Separator/>

        {/* Timestamps */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4"/>
              Created
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(task.createdAt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
