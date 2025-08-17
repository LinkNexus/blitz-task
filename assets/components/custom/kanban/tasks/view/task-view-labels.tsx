import {Badge} from "@/components/ui/badge.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardHeader, CardTitle,} from "@/components/ui/card.tsx";
import {ApiError, apiFetch} from "@/lib/fetch.ts";
import type {Label, Task} from "@/types.ts";
import {Plus, Tag, Tag as TagIcon, X} from "lucide-react";
import {useState} from "react";
import {toast} from "sonner";
import {LabelsPopup} from "@/components/custom/kanban/tasks/labels-popup.tsx";

interface TaskLabelsProps {
  task: Task;
  onTaskUpdate: (task: Task) => void;
}

export function TaskViewLabels({task, onTaskUpdate}: TaskLabelsProps) {
  const [isAddingLabel, setIsAddingLabel] = useState(false);

  async function addLabel(label: Label) {
    if (!task.labels.some(l => l.id === label.id)) {
      await apiFetch(`/api/labels/add/${label.id}?taskId=${task.id}`, {
        method: "POST"
      })
        .then(() => {
          onTaskUpdate({
            ...task,
            labels: [...task.labels, label]
          })
        })
        .catch(err => {
          if (err instanceof ApiError && err.data.message) {
            toast.error(err.data.message);
          } else {
            toast.error("Failed to add label");
          }
          console.log("Failed to add label:", err);
        });
    }
  }

  async function removeLabel(labelId: number) {
    await apiFetch(`/api/labels/remove/${labelId}?taskId=${task.id}`, {
      method: "POST"
    })
      .then(() => {
        onTaskUpdate({
          ...task,
          labels: task.labels.filter(l => l.id !== labelId)
        })
      })
      .catch(err => {
        if (err instanceof ApiError && err.data.message) {
          toast.error(err.data.message);
        } else {
          toast.error("Failed to remove label");
        }
        console.log("Failed to remove label:", err);
      })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TagIcon className="w-5 h-5"/>
            Labels
          </CardTitle>
          <LabelsPopup
            open={isAddingLabel}
            onOpenChange={setIsAddingLabel}
            onLabelAdd={addLabel}
            excludedIds={task.labels.map(label => label.id)}
            onClose={() => setIsAddingLabel(false)}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <Plus className="w-4 h-4"/>
            </Button>
          </LabelsPopup>
        </div>
      </CardHeader>
      <CardContent>
        {task.labels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {task.labels.map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                className="flex items-center gap-2 py-1 px-2"
              >
                <Tag className="w-3 h-3"/>
                <span className="text-xs">{label.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-3 w-3 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={async () => await removeLabel(label.id)}
                >
                  <X className="w-2 h-2"/>
                </Button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No labels</p>
        )}
      </CardContent>
    </Card>
  );
}
