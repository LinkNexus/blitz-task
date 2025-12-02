import {memo, useCallback} from "react";
import {FormLabel} from "@/components/ui/form.tsx";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Plus, X} from "lucide-react";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem} from "@/components/ui/command.tsx";
import type {Project} from "@/types.ts";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar.tsx";
import {Badge} from "@/components/ui/badge.tsx";

type Props = {
  onChange: (assigneeIds: number[]) => void;
  watchedAssigneeIds: number[];
  participants: Project["participants"];
}
export const AssigneesField = memo(function ({onChange, watchedAssigneeIds, participants}: Props) {
  const addAssignee = useCallback(function (userId: number) {
    if (!watchedAssigneeIds.includes(userId)) {
      onChange([...watchedAssigneeIds, userId]);
    }
  }, [watchedAssigneeIds, onChange]);

  const removeAssignee = useCallback(function (userId: number) {
    if (watchedAssigneeIds.includes(userId)) {
      onChange(watchedAssigneeIds.filter(i => i !== userId));
    }
  }, [watchedAssigneeIds, onChange])

  return (
    <div className="space-y-3">
      <FormLabel>Assignees</FormLabel>

      {watchedAssigneeIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {watchedAssigneeIds.map((userId) => {
            const user = participants.find((u) => u.id === userId);
            if (!user) return null;

            return (
              <Badge
                key={userId}
                variant="secondary"
                className="flex items-center gap-1"
                onClick={() => console.log(userId)}
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
                <span>{user.name}</span>
                <div onClick={() => removeAssignee(userId)}>
                  <X
                    className="w-3 h-3 cursor-pointer"
                  />
                </div>
              </Badge>
            );
          })}
        </div>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="w-4 h-4 mr-2"/>
            Add Assignee
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <Command>
            <CommandInput placeholder={"Search for project members"}/>
            <CommandEmpty>No member with this name found</CommandEmpty>
            <CommandGroup>
              {participants
                .filter((user) => !watchedAssigneeIds?.includes(user.id))
                .map((user) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => addAssignee(user.id)}
                  >
                    <Avatar className="w-6 h-6 mr-2">
                      <AvatarImage src="" alt={user.name}/>
                      <AvatarFallback className="text-xs">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span>{user.name}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
})
