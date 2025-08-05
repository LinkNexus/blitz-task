import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.tsx";
import {SidebarMenuButton} from "@/components/ui/sidebar.tsx";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar.tsx";
import {ChevronsUpDown, Frame, Plus, SquareTerminal} from "lucide-react";
import {useAccount} from "@/hooks/use-account.ts";
import {useState} from "react";

export function TeamSwitcher() {
  const {user} = useAccount();
  const teams = [
    {
      name: user.name,
      logo: null,
      isDefault: true
    },
    {
      name: "Design Team",
      logo: Frame,
      isDefault: false
    },
    {
      name: "Development Squad",
      logo: SquareTerminal,
      isDefault: false
    },
  ]

  const [activeTeam, setActiveTeam] = useState(teams[0]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div
            className="flex aspect-square size-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
            {activeTeam.logo ? (
              <activeTeam.logo className="size-4"/>
            ) : (
              <Avatar>
                <AvatarImage src="https://ui.shadcn.com/avatars/shadcn.jpg" alt="profile picture"/>
                <AvatarFallback className="rounded-lg">
                  {activeTeam.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeTeam.name}
                </span>
          </div>
          <ChevronsUpDown className="ml-auto"/>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Teams
        </DropdownMenuLabel>
        {teams.map((team, index) => (
          <DropdownMenuItem
            key={team.name}
            onClick={() => setActiveTeam(team)}
            className="gap-2 p-2"
          >
            <div className="flex size-6 items-center justify-center rounded-sm border">
              {team.logo ? (
                <team.logo className="size-4 shrink-0"/>
              ) : (
                <Avatar className="h-6 w-6 rounded-lg">
                  <AvatarImage src="https://ui.shadcn.com/avatars/shadcn.jpg" alt="profile picture"/>
                  <AvatarFallback className="rounded-lg">
                    {activeTeam.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            {team.name}
            <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator/>
        <DropdownMenuItem className="gap-2 p-2">
          <div className="flex size-6 items-center justify-center rounded-md border bg-background">
            <Plus className="size-4"/>
          </div>
          <div className="font-medium text-muted-foreground">
            Add team
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
