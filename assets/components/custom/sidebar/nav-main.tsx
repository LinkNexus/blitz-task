import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Folder, Home, Inbox, Kanban, Search } from "lucide-react";
import { useCallback, useMemo, type ComponentType } from "react";
import { Link, useLocation, useSearchParams } from "wouter";

type NavigationItem = {
  title: string;
  url: string;
  icon: ComponentType<any>;
  isActive: boolean;
  badge?: string;
};

const projects = [
  {
    name: "Project Alpha",
  },
  {
    name: "Project Beta",
  },
  {
    name: "Project Gamma",
  },
];

export function NavMain() {
  const [currentLocation] = useLocation();

  const items = useMemo(
    (): NavigationItem[] => [
      {
        title: "Search",
        url: "/search",
        icon: Search,
        isActive: currentLocation === "/search",
      },
      {
        title: "Home",
        url: "/",
        icon: Home,
        isActive: currentLocation === "/",
      },
      {
        title: "Notifications",
        url: "/notifications",
        icon: Inbox,
        isActive: currentLocation === "/notifications",
      },
      {
        title: "Tasks",
        url: "/tasks",
        icon: Kanban,
        isActive: currentLocation.includes("/tasks"),
      },
      {
        title: "Projects",
        url: "/projects",
        icon: Folder,
        isActive: currentLocation === "/projects",
      },
    ],
    [currentLocation],
  );

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              {item.title === "Projects" ? (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={item.isActive}
                    >
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="w-full">
                      {!projects ? (
                        <Spinner className="size-3" />
                      ) : (
                        projects.map((p) => (
                          <SidebarMenuSubItem key={p.name}>
                            <SidebarMenuSubButton asChild>
                              <Link href={"/projects"}>
                                <span>{p.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : (
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={item.isActive}
                >
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    {"badge" in item && item.badge && (
                      <Badge variant="secondary" className="ml-auto">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
