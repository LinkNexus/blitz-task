import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from "@/components/ui/sidebar.tsx";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@/components/ui/collapsible.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {Bot, ChevronRight, Folder, Home, Inbox, Kanban, Users} from "lucide-react";
import {Link, useLocation} from "wouter";

const items = [
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
    items: [
      {
        title: "Website Redesign",
        url: "/projects/website-redesign",
      },
      {
        title: "Mobile App",
        url: "/projects/mobile-app",
      },
      {
        title: "Marketing Campaign",
        url: "/projects/marketing",
      },
    ],
  },
  {
    title: "Teams",
    url: "/teams",
    icon: Users,
    items: [
      {
        title: "Design Team",
        url: "/teams/design",
        badge: "6",
      },
      {
        title: "Development",
        url: "/teams/dev",
        badge: "12",
      },
      {
        title: "Marketing",
        url: "/teams/marketing",
        badge: "4",
      },
    ],
  },
]

export function NavMain() {
  const [location] = useLocation();
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
              {item.items ? (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title} isActive={location === item.url}>
                      {item.icon && <item.icon/>}
                      <span>{item.title}</span>
                      {'badge' in item && item.badge && (
                        <Badge variant="secondary" className="ml-auto">
                          {item.badge}
                        </Badge>
                      )}
                      <ChevronRight
                        className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"/>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="w-full">
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={location === subItem.url}>
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                              {subItem.badge && (
                                <Badge variant="outline" className="ml-auto">
                                  {subItem.badge}
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : (
                <SidebarMenuButton asChild tooltip={item.title} isActive={location === item.url}>
                  <Link href={item.url}>
                    {item.icon && <item.icon/>}
                    <span>{item.title}</span>
                    {'badge' in item && item.badge && (
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
