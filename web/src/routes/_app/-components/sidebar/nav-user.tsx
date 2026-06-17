import {
  IconCheck,
  IconDeviceLaptop,
  IconLogout,
  IconMoon,
  IconPalette,
  IconSun,
  IconUser,
} from "@tabler/icons-react";
import { memo } from "react";
import { logout } from "@/api";
import { useTheme } from "@/components/theme-provider";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { SidebarMenuButton } from "@/components/ui/sidebar.tsx";
import { useAccount } from "@/hooks/use-current-user";

export const NavUser = memo(() => {
  const { user } = useAccount();
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: "light" as const, label: "Light", icon: IconSun },
    { value: "dark" as const, label: "Dark", icon: IconMoon },
    { value: "system" as const, label: "System", icon: IconDeviceLaptop },
  ];

  const userInitials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-colors"
        >
          <Avatar className="h-8 w-8 rounded-lg border border-sidebar-border">
            <AvatarImage src={""} alt={user?.name || "User"} />
            <AvatarFallback className="rounded-lg font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col gap-0.5 text-left text-sm leading-tight">
            <span className="truncate font-semibold text-sidebar-foreground">
              {user?.name || "User"}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              {user?.email || "user@example.com"}
            </span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-60 rounded-lg"
        side="bottom"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={""} alt={user?.name || "User"} />
              <AvatarFallback className="rounded-lg">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col gap-0.5 text-left text-sm">
              <p className="truncate font-semibold">{user?.name || "User"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email || "user@example.com"}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer">
            <IconUser className="h-4 w-4" />
            <span>Profile Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <IconPalette className="h-4 w-4" />
            <span>Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {themeOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setTheme(option.value)}
                className="cursor-pointer"
              >
                <option.icon className="h-4 w-4" />
                <span>{option.label}</span>
                {theme === option.value && (
                  <IconCheck className="ml-auto h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:bg-destructive focus:text-destructive-foreground"
        >
          <IconLogout className="h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
