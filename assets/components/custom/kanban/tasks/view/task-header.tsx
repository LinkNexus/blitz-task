import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { apiFetch } from "@/lib/fetch.ts";
import type { Task } from "@/types.ts";
import {
    Calendar,
    Clock,
    Edit,
    Flag,
    Save,
    Tag,
    User,
    X
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TaskHeaderProps {
  task: Task;
  onTaskUpdate: (task: Task) => void;
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

export function TaskHeader({ task, onTaskUpdate }: TaskHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState({
    name: task.name,
    description: task.description,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updatedTask = await apiFetch<Task>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        data: {
          name: editedTask.name,
          description: editedTask.description,
        },
      });

      onTaskUpdate(updatedTask);
      setIsEditing(false);
      toast.success("Task updated successfully");
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error("Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedTask({
      name: task.name,
      description: task.description,
    });
    setIsEditing(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No due date";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            {isEditing ? (
              <Input
                value={editedTask.name}
                onChange={(e) => setEditedTask({ ...editedTask, name: e.target.value })}
                className="text-2xl font-bold h-auto py-2"
                placeholder="Task name"
              />
            ) : (
              <h1 className="text-2xl sm:text-3xl font-bold">{task.name}</h1>
            )}
            
            {/* Task meta information */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Flag className="w-4 h-4" />
                <Badge variant="outline" className={priorityColors[task.priority]}>
                  {priorityLabels[task.priority]}
                </Badge>
              </div>
              
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(task.dueAt)}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Labels */}
            {task.labels.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-4 h-4 text-muted-foreground" />
                {task.labels.map((label) => (
                  <Badge key={label.id} variant="secondary">
                    {label.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Assignees */}
            {task.assignees.length > 0 && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div className="flex gap-2 flex-wrap">
                  {task.assignees.map((assignee) => (
                    <Badge key={assignee.id} variant="outline">
                      {assignee.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-4">
            {isEditing ? (
              <>
                <Button
                  onClick={handleSave}
                  size="sm"
                  disabled={saving || !editedTask.name.trim()}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  size="sm"
                  disabled={saving}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {(task.description || isEditing) && (
        <CardContent className="pt-0">
          {isEditing ? (
            <Textarea
              value={editedTask.description}
              onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
              placeholder="Task description"
              rows={4}
              className="resize-none"
            />
          ) : (
            <div className="prose max-w-none">
              <p className="text-muted-foreground whitespace-pre-wrap">
                {task.description || "No description provided."}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
