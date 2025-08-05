import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar.tsx"
import {Favorites} from "@/components/custom/sidebar/favorites.tsx";
import {NavUser} from "@/components/custom/sidebar/nav-user.tsx";
import {type ComponentProps} from "react";
import {NavSecondary} from "@/components/custom/sidebar/nav-secondary.tsx";
import {TeamSwitcher} from "@/components/custom/sidebar/team-switcher.tsx";
import {NavMain} from "@/components/custom/sidebar/nav-main.tsx";

export function AppSidebar({...props}: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <img
            src="/logo.svg"
            alt="Blitz-Task"
            className="h-10 w-10"
          />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Blitz-Task</span>
            <span className="truncate text-xs text-muted-foreground">
              Tasks Management
            </span>
          </div>
        </div>

        <TeamSwitcher/>
      </SidebarHeader>

      <SidebarContent>
        <NavMain/>
        <Favorites/>
        <NavSecondary/>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavUser/>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail/>
    </Sidebar>
  )
}
