import { Link, useLocation } from "@tanstack/react-router";
import { memo } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar.tsx";
import { getSecondaryItems } from "./sidebar-config.ts";

export const NavSecondary = memo(() => {
  const location = useLocation();
  const secondaryItems = getSecondaryItems();

  const isActive = (href: string) => {
    return location.pathname.startsWith(href);
  };

  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupLabel className="text-xs font-semibold">
        Tools
      </SidebarGroupLabel>
      <SidebarMenu>
        {secondaryItems.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              asChild
              isActive={isActive(item.href)}
              tooltip={
                item.description
                  ? {
                      children: (
                        <div className="space-y-1">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      ),
                    }
                  : item.title
              }
            >
              <Link to={item.href}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm font-medium">
                  {item.title}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
});
