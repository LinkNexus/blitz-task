import {Avatar, AvatarFallback} from "@/components/ui/avatar.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardHeader, CardTitle,} from "@/components/ui/card.tsx";
import type {Task, Team} from "@/types.ts";
import {Plus, User as UserIcon, X} from "lucide-react";
import {memo, useCallback, useState} from "react";
import {AssigneesPopup} from "@/components/custom/kanban/tasks/assignees-popup.tsx";
import {ApiError, apiFetch} from "@/lib/fetch.ts";
import {toast} from "sonner";

interface TaskAssigneesProps {
  id: number;
  assignees: Task["assignees"];
  teamMembers: Team["members"];
  onAssigneeAdd: (user: Task["assignees"][number]) => void;
  onAssigneeRemove: (userId: number) => void;
}

export const TaskViewAssignees = memo(function ({
  id,
  assignees,
  teamMembers,
  onAssigneeAdd,
  onAssigneeRemove
}: TaskAssigneesProps) {
  const [isAddingAssignee, setIsAddingAssignee] = useState(false);

  const addAssignee = useCallback(async function (user: Task["assignees"][number]) {
    await apiFetch(`/api/tasks/${id}/add-assignee?userId=${user.id}`, {method: "POST"})
      .then(() => {
        onAssigneeAdd(user);
        toast.success(`"${user.name}" was added successfully as assignee to this task`);
      })
      .catch(err => {
        let message: string;

        if (err instanceof ApiError) {
          message = err.data.message;
        } else {
          message = "An error happened when adding the assignee";
        }

        toast.error(message, {
          closeButton: true
        });
        console.log("Failed to add assignee:", err);
      })
  }, [id, onAssigneeAdd]);

  const removeAssignee = useCallback(async function (user: Task["assignees"][number]) {
    await apiFetch(`/api/tasks/${id}/remove-assignee?userId=${user.id}`, {method: "POST"})
      .then(() => {
        onAssigneeRemove(user.id);
        toast.success(`"${user.name} was successfully removed as assignee to this task"`);
      })
      .catch(err => {
        let message: string;

        if (err instanceof ApiError) {
          message = err.data.message;
        } else {
          message = "An error happened when removing the assignee";
        }

        toast.error(message, {
          closeButton: true
        });
        console.log("Failed to remove assignee:", err);
      })
  }, [id, onAssigneeRemove])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5"/>
            Assignees
          </CardTitle>
          <AssigneesPopup
            open={isAddingAssignee}
            onOpenChange={setIsAddingAssignee}
            excludedIds={assignees.map(assignee => assignee.id)}
            teamMembers={teamMembers}
            onAssigneeAdd={addAssignee}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <Plus className="w-4 h-4"/>
            </Button>
          </AssigneesPopup>
        </div>
      </CardHeader>
      <CardContent>
        {assignees.length > 0 ? (
          <div className="space-y-2">
            {assignees.map((assignee) => (
              <div
                key={assignee.id}
                className="flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs">
                      {assignee.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{assignee.name}</span>
                </div>
                <Button
                  onClick={async () => await removeAssignee(assignee)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="w-3 h-3"/>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No assignees</p>
        )}
      </CardContent>
    </Card>
  );
});
