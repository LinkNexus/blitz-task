import {
  IconCalendar,
  IconHome,
  IconInbox,
  IconRobot,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";

export type NavItemType = "main" | "secondary" | "action";

export interface NavItem {
  id: string;
  title: string;
  href: string;
  icon: typeof IconHome;
  description?: string;
  badge?: string | number;
  type: NavItemType;
  disabled?: boolean;
}

export const navigationConfig: NavItem[] = [
  // Main Navigation
  {
    id: "home",
    title: "Dashboard",
    href: "/dashboard",
    icon: IconHome,
    type: "main",
    description: "Overview of your tasks",
  },
  {
    id: "inbox",
    title: "Inbox",
    href: "/inbox",
    icon: IconInbox,
    type: "main",
    description: "Your task inbox",
  },
  {
    id: "search",
    title: "Search",
    href: "/search",
    icon: IconSearch,
    type: "main",
    description: "Find tasks quickly",
  },
  {
    id: "ai",
    title: "Ask AI",
    href: "/ask-ai",
    icon: IconRobot,
    type: "main",
    description: "AI-powered assistance",
  },

  // Secondary Navigation (Tools)
  {
    id: "calendar",
    title: "Calendar",
    href: "/calendar",
    icon: IconCalendar,
    type: "secondary",
    description: "View tasks by date",
  },
  {
    id: "trash",
    title: "Trash",
    href: "/trash",
    icon: IconTrash,
    type: "secondary",
    description: "Deleted items",
  },
];

export const getMainItems = () =>
  navigationConfig.filter((item) => item.type === "main");
export const getSecondaryItems = () =>
  navigationConfig.filter((item) => item.type === "secondary");
export const getItemById = (id: string) =>
  navigationConfig.find((item) => item.id === id);
