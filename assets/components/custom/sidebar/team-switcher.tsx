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
import {ChevronsUpDown, Loader2, Plus} from "lucide-react";
import {useEffect} from "react";
import {useSearchParams} from "wouter";
import {useApiFetch} from "@/hooks/use-fetch.ts";
import {toast} from "sonner";
import {useAppStore} from "@/lib/store.ts";

export function TeamSwitcher() {
  const {teams, setTeams} = useAppStore(state => state);
  const [params, setParams] = useSearchParams();
  const activeTeamId = params.get("teamId");
  const activeTeam = teams.find(t => t.id === Number(activeTeamId));

  const {callback: fetchTeams} = useApiFetch("/api/teams", {
    onSuccess: setTeams,
    onError() {
      toast.error("An error occurred when fetching the teams list");
    }
  })

  useEffect(() => {
    fetchTeams();
  }, []);

  if (!activeTeam) {
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
                {activeTeam.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
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
            onClick={() => {
              if (activeTeam.id !== team.id) {
                setParams(prev => {
                  prev.set("teamId", team.id.toString());
                  return prev;
                })
              }
            }}
            className="gap-2 p-2"
          >
            <div className="flex size-6 items-center justify-center rounded-sm border">
              <Avatar className="h-6 w-6 rounded-lg">
                <AvatarImage
                  src="https://ui.shadcn.com/avatars/shadcn.jpg"
                  alt="profile picture"
                />
                <AvatarFallback className="rounded-lg">
                  {activeTeam.name.split(" ")
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
