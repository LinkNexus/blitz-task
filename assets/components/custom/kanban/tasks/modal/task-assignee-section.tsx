import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {Button} from "@/components/ui/button.tsx";
import {FormField, FormItem, FormLabel} from "@/components/ui/form.tsx";
import type {TaskFormData} from "@/hooks/useTaskForm.ts";
import type {Team} from "@/types.ts";
import {Plus, X} from "lucide-react";
import type {UseFormReturn} from "react-hook-form";
import {useState} from "react";
import {AssigneesPopup} from "@/components/custom/kanban/tasks/assignees-popup.tsx";

interface TaskAssigneeSectionProps {
  form: UseFormReturn<TaskFormData>;
  teamMembers: Team["members"];
}

export function TaskAssigneeSection({form, teamMembers}: TaskAssigneeSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const watchedAssigneeIds = form.watch("assigneeIds") || [];

  function addAssignee(userId: number) {
    if (!watchedAssigneeIds.includes(userId)) {
      form.setValue("assigneeIds", [...watchedAssigneeIds, userId]);
    }
  }

  function removeAssignee(userId: number) {
    form.setValue(
      "assigneeIds",
      watchedAssigneeIds.filter((id) => id !== userId)
    );
  }

  return (
    <FormField
      control={form.control}
      name="assigneeIds"
      render={() => (
        <FormItem>
          <FormLabel>Assignees</FormLabel>
          <div className="space-y-3">
            {/* Current Assignees */}
            <div className="flex flex-wrap gap-2">
              {watchedAssigneeIds.map((userId) => {
                const user = teamMembers.find((u) => u.id === userId);
                if (!user) return null;

                return (
                  <Badge
                    key={userId}
                    variant="secondary"
                    className="flex items-center gap-2 py-1 px-2"
                  >
                    <Avatar className="w-4 h-4">
                      <AvatarImage src="" alt={user.name}/>
                      <AvatarFallback className="text-xs">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{user.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-3 w-3 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeAssignee(userId)}
                    >
                      <X className="w-2 h-2"/>
                    </Button>
                  </Badge>
                );
              })}
            </div>

            {/* Add Assignee Popover */}
            <AssigneesPopup
              open={isModalOpen}
              onOpenChange={setIsModalOpen}
              teamMembers={teamMembers}
              onAssigneeAdd={(user) => addAssignee(user.id)}
              excludedIds={watchedAssigneeIds}
              onClose={() => setIsModalOpen(false)}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
              >
                <Plus className="w-3 h-3 mr-1"/>
                Add Assignee
              </Button>
            </AssigneesPopup>
          </div>
        </FormItem>
      )}
    />
  );
}
