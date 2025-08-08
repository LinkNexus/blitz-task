import {Badge} from "@/components/ui/badge.tsx";
import {Collapsible, CollapsibleContent, CollapsibleTrigger,} from "@/components/ui/collapsible.tsx";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar.tsx";
import {Bot, ChevronRight, Folder, Home, Inbox, Kanban, Loader2} from "lucide-react";
import {Link, useLocation, useSearchParams} from "wouter";
import {useAppStore} from "@/lib/store.ts";

interface NavigationItem {
  title: string;
  url: string;
  icon: React.ComponentType<any>;
  isActive?: boolean;
  badge?: string;
}

const items: NavigationItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    isActive: true,
  },
  {
    title: "Inbox",
    url: "/inbox",
    icon: Inbox,
    badge: "12",
  },
  {
    title: "Board",
    url: "/issues-board",
    icon: Kanban,
  },
  {
    title: "AI Chat",
    url: "/ai-chat",
    icon: Bot,
  },
  {
    title: "Projects",
    url: "/projects",
    icon: Folder,
  },
];

export function NavMain() {
  const [location] = useLocation();
  const [params] = useSearchParams();
  const activeTeamId = params.get("teamId") ? Number(params.get("teamId")) : null;
  const activeProjectId = params.get("projectId") ? Number(params.get("projectId")) : null;
  const {teams} = useAppStore(state => state);
  const projects = teams.find(t => t.id === activeTeamId)?.projects;

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
                      isActive={location === item.url}
                    >
                      {item.icon && <item.icon/>}
                      <span>{item.title}</span>
                      <ChevronRight
                        className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"/>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="w-full">
                      {!projects ? (
                        <Loader2 className="animate-spin size-3"/>
                      ) : projects.map((p) => (
                        <SidebarMenuSubItem key={p.id}>
                          <SidebarMenuSubButton
                            asChild
                          >
                            <Link href={"/projects"}>
                              <span>{p.isDefault ? "Personal Profile" : p.name}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : (item.title === "Badge" && !activeProjectId) ? null : (
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={location === item.url}
                >
                  <Link href={item.url}>
                    {item.icon && <item.icon/>}
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
