import { Link, useLocation } from "@tanstack/react-router";
import { memo } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar.tsx";
import { getMainItems } from "./sidebar-config.ts";

export const NavMain = memo(() => {
  const location = useLocation();
  const mainItems = getMainItems();

  const isActive = (href: string) => {
    // Handle root path
    if (href === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-semibold">
        Navigation
      </SidebarGroupLabel>
      <SidebarMenu>
        {mainItems.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              asChild
              isActive={isActive(item.href)}
              tooltip={{
                children: (
                  <div className="space-y-1">
                    <p className="font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                ),
              }}
              className="relative"
            >
              <Link to={item.href}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm font-medium">
                  {item.title}
                </span>
                {item.badge && (
                  <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {item.badge}
                  </span>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
});
