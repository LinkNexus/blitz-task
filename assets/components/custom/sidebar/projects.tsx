import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { MoreHorizontal, Plus } from "lucide-react";
import { Link } from "wouter";

const projects = [
  {
    id: 1,
    name: "Project Alpha",
    emoji: "🚀",
  },
  {
    id: 2,
    name: "Project Beta",
    emoji: "🎯",
  },
  {
    id: 3,
    name: "Project Gamma",
    emoji: "📈",
  },
  {
    id: 4,
    name: "Project Delta",
    emoji: "💡",
  },
];

export function SidebarProjects() {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {projects.map((p) => (
            <SidebarMenuItem key={p.id}>
              <SidebarMenuButton asChild>
                <Link href={`/projects/${p.id}`}>
                  <span>{p.emoji}</span>
                  <span>{p.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton className="text-shadow-sidebar-foreground/70">
              <Plus />
              <span>Add</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-shadow-sidebar-foreground/70">
              <MoreHorizontal />
              <span>More</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
