import {
  IconBell,
  IconBellOff,
  IconCheck,
  IconDeviceLaptop,
  IconDownload,
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
import { clearApiCache } from "@/hooks/use-offline";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { requestImport } from "../import-dialog";

export const NavUser = memo(() => {
  const { user } = useAccount();
  const { theme, setTheme } = useTheme();
  const push = usePushNotifications();

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
      // The cached board belongs to whoever was signed in when it was fetched; on a shared
      // device the next person must not be served it from disk.
      await clearApiCache();
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
        {/* Hidden entirely when this instance has no VAPID keypair, or the browser cannot do
            push: a switch that cannot work is worse than no switch. Only ever asks for
            permission because it was pressed — an unprompted request is the reliable way to be
            denied permanently, and a denial can only be undone in browser settings. */}
        {push.state !== "unsupported" && push.state !== "unconfigured" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={push.busy || push.state === "denied"}
              onSelect={(e) => {
                e.preventDefault();
                if (push.state === "on") push.disable();
                else push.enable();
              }}
            >
              {push.state === "on" ? (
                <IconBellOff className="h-4 w-4" />
              ) : (
                <IconBell className="h-4 w-4" />
              )}
              <span>
                {push.state === "denied"
                  ? "Notifications blocked"
                  : push.state === "on"
                    ? "Turn off notifications"
                    : "Notify me on this device"}
              </span>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <IconDownload className="h-4 w-4" />
            <span>Export data</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {/* Plain links rather than a mutation: these are GETs, the auth cookie rides along
                and Content-Disposition names the file, so the browser already does this job. */}
            <DropdownMenuItem asChild className="cursor-pointer">
              <a href="/api/export?format=json" download>
                <span>Everything (JSON)</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <a href="/api/export?format=csv" download>
                <span>Everything (CSV)</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={requestImport}
              className="cursor-pointer"
            >
              <span>Import from a file…</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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
