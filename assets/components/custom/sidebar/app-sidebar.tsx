import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { memo, type ComponentProps } from "react";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { NavUser } from "./nav-user";
import { NavProjects } from "./nav-projects";

const AppSidebar = memo(function ({
	...props
}: ComponentProps<typeof Sidebar>) {
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
				<NavProjects />
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
