import type { ComponentProps } from "react";
import Logo from "@/assets/logo.svg";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar.tsx";
import { NavMain } from "./nav-main.tsx";
import { NavProjects } from "./nav-projects.tsx";
import { NavSecondary } from "./nav-secondary.tsx";
import { NavUser } from "./nav-user.tsx";

export const AppSidebar = ({ ...props }: ComponentProps<typeof Sidebar>) => (
  <Sidebar collapsible="icon" {...props}>
    {/* Header with logo */}
    <SidebarHeader>
      <div className="flex items-center gap-2 px-2 py-2">
        <img src={Logo} alt="Blitz-Task" className="h-10 w-10" />
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">Blitz-Task</span>
          <span className="truncate text-xs text-muted-foreground">
            Tasks Management
          </span>
        </div>
      </div>
    </SidebarHeader>

    {/* Main navigation content */}
    <SidebarContent className="gap-0">
      <NavMain />
      <NavProjects />
      <NavSecondary />
    </SidebarContent>

    {/* User menu footer */}
    <SidebarFooter className="border-t border-sidebar-border">
      <SidebarMenu>
        <SidebarMenuItem>
          <NavUser />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
);
