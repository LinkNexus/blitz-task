import {Popover, PopoverContent, PopoverTrigger,} from "@/components/ui/popover.tsx";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,} from "@/components/ui/command.tsx";
import {Avatar, AvatarFallback, AvatarImage,} from "@/components/ui/avatar.tsx";
import {memo, type ReactNode} from "react";
import type {Task} from "@/types.ts";

interface AssigneesPopupProps {
  teamMembers: Task["assignees"];
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onAssigneeAdd: (user: Task["assignees"][0]) => void;
  excludedIds?: number[];
}

export const AssigneesPopup = memo(function ({
  teamMembers,
  open,
  children,
  onOpenChange,
  onAssigneeAdd,
  excludedIds = [],
  onClose,
}: AssigneesPopupProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {children && <PopoverTrigger asChild>{children}</PopoverTrigger>}
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search team members..."/>
          <CommandEmpty>No team members found.</CommandEmpty>
          <CommandGroup>
            {teamMembers
              .filter((user) => !excludedIds.includes(user.id))
              .map((user) => (
                <CommandItem
                  key={user.id}
                  onSelect={() => {
                    onAssigneeAdd(user);
                    onClose?.();
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src="" alt={user.name}/>
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
  );
});
