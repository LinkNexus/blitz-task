import { Avatar, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { useApiFetch } from "@/hooks/useApiFetch.ts";
import { apiFetch } from "@/lib/fetch.ts";
import type { Task, User } from "@/types.ts";
import { Plus, User as UserIcon, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TaskAssigneesProps {
  task: Task;
  onTaskUpdate: (task: Task) => void;
}

export function TaskAssignees({ task, onTaskUpdate }: TaskAssigneesProps) {
  const [isAddingAssignee, setIsAddingAssignee] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<
    Pick<User, "id" | "name">[]
  >([]);

  const { callback: fetchUsers, pending: isLoadingUsers } = useApiFetch<
    Pick<User, "id" | "name">[],
    never
  >("/api/users", {
    onSuccess: setAvailableUsers,
    onError: (error) => {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to load users");
    },
  });

  const handleAddAssignee = async (userId: number) => {
    try {
      const updatedTask = await apiFetch<Task>(
        `/api/tasks/${task.id}/assignees`,
        {
          method: "POST",
          data: { userId },
        }
      );
      onTaskUpdate(updatedTask);
      setIsAddingAssignee(false);
      toast.success("Assignee added successfully");
    } catch (error) {
      console.error("Failed to add assignee:", error);
      toast.error("Failed to add assignee");
    }
  };

  const handleRemoveAssignee = async (userId: number) => {
    try {
      const updatedTask = await apiFetch<Task>(
        `/api/tasks/${task.id}/assignees/${userId}`,
        {
          method: "DELETE",
        }
      );
      onTaskUpdate(updatedTask);
      toast.success("Assignee removed successfully");
    } catch (error) {
      console.error("Failed to remove assignee:", error);
      toast.error("Failed to remove assignee");
    }
  };

  const openAddAssignee = () => {
    setIsAddingAssignee(true);
    fetchUsers();
  };

  const availableUsersToAdd = availableUsers.filter(
    (user) => !task.assignees.some((assignee) => assignee.id === user.id)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            Assignees
          </CardTitle>
          <Popover open={isAddingAssignee} onOpenChange={setIsAddingAssignee}>
            <PopoverTrigger asChild>
              <Button
                onClick={openAddAssignee}
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0">
              <Command>
                <CommandInput placeholder="Search users..." />
                <CommandEmpty>
                  {isLoadingUsers ? "Loading users..." : "No users found."}
                </CommandEmpty>
                <CommandGroup>
                  {availableUsersToAdd.map((user) => (
                    <CommandItem
                      key={user.id}
                      onSelect={() => handleAddAssignee(user.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span>{user.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        {task.assignees.length > 0 ? (
          <div className="space-y-2">
            {task.assignees.map((assignee) => (
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
                  onClick={() => handleRemoveAssignee(assignee.id)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="w-3 h-3" />
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
}
