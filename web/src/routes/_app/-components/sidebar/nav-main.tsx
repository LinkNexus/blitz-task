import { Link, useLocation } from "@tanstack/react-router";
import { memo } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar.tsx";
import { requestCommandPalette } from "../command-palette";
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
              {/* Search opens the palette instead of travelling to a page — being sent
                  elsewhere to type a query means leaving whatever you were looking at in
                  order to go and find something else. It stays an anchor so ⌘-click and
                  "open in new tab" still reach /search, which remains the shareable form
                  of a query. */}
              <Link
                to={item.href}
                onClick={(e) => {
                  if (item.id !== "search") return;
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)
                    return;
                  e.preventDefault();
                  requestCommandPalette();
                }}
              >
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
