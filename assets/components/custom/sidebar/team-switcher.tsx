import {Avatar, AvatarFallback, AvatarImage,} from "@/components/ui/avatar.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {SidebarMenuButton} from "@/components/ui/sidebar.tsx";
import {useAccount} from "@/hooks/use-account.ts";
import {apiFetch} from "@/lib/fetch.ts";
import {useAppStore} from "@/lib/store.ts";
import type {Team} from "@/types.ts";
import {ChevronsUpDown, Loader2, Plus} from "lucide-react";
import {useEffect} from "react";
import {toast} from "sonner";

export function TeamSwitcher() {
  const {user} = useAccount();
  const {teams, setActiveTeam, setTeams} = useAppStore((state) => state);

  useEffect(() => {
    if (!teams.fetched) {
      apiFetch<Team[]>(`/api/teams?userId=${user.id}`)
        .then(setTeams)
        .catch(() => {
          toast.error("An error occured when loading the teams list");
        });
    }
  }, [user.id, teams.fetched]);

  if (!teams.fetched || teams.data.length === 0 || !teams.activeTeam) {
    return (
      <span
        className="flex items-center justify-center py-4"
        aria-label="Loading teams"
        role="status"
      >
        <Loader2 className="size-5 animate-spin text-muted-foreground"/>
        <span className="sr-only">Loading teams...</span>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div
            className="flex aspect-square size-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
            <Avatar>
              <AvatarImage
                src="https://ui.shadcn.com/avatars/shadcn.jpg"
                alt="profile picture"
              />
              <AvatarFallback className="rounded-lg">
                {teams.activeTeam.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">
              {teams.activeTeam.name}
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
        {teams.data.map((team, index) => (
          <DropdownMenuItem
            key={team.name}
            onClick={() => setActiveTeam(team.id)}
            className="gap-2 p-2"
          >
            <div className="flex size-6 items-center justify-center rounded-sm border">
              <Avatar className="h-6 w-6 rounded-lg">
                <AvatarImage
                  src="https://ui.shadcn.com/avatars/shadcn.jpg"
                  alt="profile picture"
                />
                <AvatarFallback className="rounded-lg">
                  {teams
                    .activeTeam!.name.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
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
          <div className="font-medium text-muted-foreground">Add team</div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
