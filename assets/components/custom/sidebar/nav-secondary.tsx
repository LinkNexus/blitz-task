import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Calendar, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Link, useLocation } from "wouter";

export function NavSecondary() {
  const [currentLocation] = useLocation();

  const tools = useMemo(
    () => [
      {
        title: "Calendar",
        url: "/calendar",
        icon: Calendar,
        isActive: currentLocation.includes("/calendar"),
      },
      {
        title: "Trash",
        url: "/trash",
        icon: Trash2,
        isActive: currentLocation.includes("/trash"),
      },
    ],
    [currentLocation],
  );

  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupLabel>Tools</SidebarGroupLabel>
      <SidebarMenu>
        {tools.map((t) => (
          <SidebarMenuItem key={t.title}>
            <SidebarMenuButton asChild tooltip={t.title} isActive={t.isActive}>
              <Link href={t.url}>
                <t.icon />
                <span>{t.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
