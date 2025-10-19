import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { ChevronsUpDown } from "lucide-react";
import { memo, type ComponentProps } from "react";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { NavUser } from "./nav-user";

const AppSidebar = memo(function ({
  ...props
}: ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <img src="/logo.svg" alt="Blitz-Task" className="h-10 w-10" />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Blitz-Task</span>
            <span className="truncate text-xs text-muted-foreground">
              Tasks Management
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavMain />
        <NavSecondary />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavUser />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
});

export { AppSidebar };
