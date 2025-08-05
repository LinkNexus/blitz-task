import * as React from "react"
import {Link, useLocation} from "wouter"
import {
  Archive,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  Folder,
  Frame,
  Home,
  Inbox,
  Kanban,
  LogOut,
  MoreHorizontal,
  PieChart,
  Plus,
  Settings,
  Share,
  Sparkles,
  SquareTerminal,
  Star,
  Trash2,
  User,
  Users,
  Zap,
} from "lucide-react"

import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {Badge} from "@/components/ui/badge"
import {Collapsible, CollapsibleContent, CollapsibleTrigger,} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {useAccount} from "@/hooks/use-account"

// Mock data for projects and teams
const data = {
  user: {
    name: "John Doe",
    email: "john@example.com",
    avatar: "/avatars/john.jpg",
  },
  teams: [
    {
      name: "Design Team",
      logo: Frame,
      isDefault: false
    },
    {
      name: "Development Squad",
      logo: SquareTerminal,
      isDefault: false
    },
  ],
  navMain: [
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
      url: "/tasks",
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
  ],
  navSecondary: [
    {
      title: "Calendar",
      url: "/calendar",
      icon: Calendar,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: BarChart3,
    },
    {
      title: "Goals",
      url: "/goals",
      icon: Zap,
    },
  ],
  navAI: [
    {
      title: "AI Assistant",
      url: "/ai-chat",
      icon: Bot,
      description: "Get help with your tasks",
    },
    {
      title: "Smart Insights",
      url: "/insights",
      icon: Sparkles,
      description: "Productivity analytics",
    },
  ],
  favorites: [
    {
      name: "Website Redesign",
      url: "/projects/website-redesign",
      status: "active",
      teamId: 0
    },
    {
      name: "Mobile App",
      url: "/projects/mobile-app",
      status: "archived",
      teamId: 1
    },
    {
      name: "Marketing Campaign",
      url: "/projects/marketing",
      teamId: 2
    },
  ],
}

export function AppSidebar({...props}: React.ComponentProps<typeof Sidebar>) {
  const {user} = useAccount()
  const [location] = useLocation()
  const teams = [{
    name: user?.name || "Personal",
    logo: null,
    isDefault: true
  }, ...data.teams]
  const [activeTeam, setActiveTeam] = React.useState(teams[0]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <img
            src="/logo.svg"
            alt="BlitzTask"
            className="h-8 w-8"
          />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">BlitzTask</span>
            <span className="truncate text-xs text-muted-foreground">
              Tasks Management
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div
                className="flex aspect-square size-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
                {activeTeam.logo ? (
                  <activeTeam.logo className="size-4"/>
                ) : (
                  <User className="size-4 text-white" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeTeam.name}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto"/>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Teams
            </DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem
                key={team.name}
                onClick={() => setActiveTeam(team)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  {team.logo ? (
                    <team.logo className="size-4 shrink-0"/>
                  ) : (
                    <User className="size-4" />
                  )}
                </div>
                {team.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator/>
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4"/>
              </div>
              <div className="font-medium text-muted-foreground">
                Add team
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            {data.navMain.map((item) => (
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
                                  {'badge' in subItem && subItem.badge && (
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

        {/* Recent Projects */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>
            <div className="flex items-center gap-x-2">
              <Star className="size-3"/>
              Favorites
            </div>
          </SidebarGroupLabel>
          <SidebarMenu>
            {data.favorites.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild isActive={location === item.url}>
                  <Link href={item.url}>
                    <div className="flex aspect-square size-6 items-center justify-center rounded-sm border bg-sidebar-accent">
                      <PieChart className="size-3" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{item.name}</span>
                    </div>
                    {item.status === "archived" && (
                      <Archive className="ml-auto text-muted-foreground size-4"/>
                    )}
                  </Link>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction showOnHover>
                      <MoreHorizontal/>
                      <span className="sr-only">More</span>
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-48 rounded-lg"
                    side="bottom"
                    align="end"
                  >
                    <DropdownMenuItem>
                      <Folder className="text-muted-foreground"/>
                      <span>View Project</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share className="text-muted-foreground"/>
                      <span>Share Project</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator/>
                    <DropdownMenuItem>
                      <Trash2 className="text-muted-foreground"/>
                      <span>Delete Project</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem className="text-muted-foreground">
              <SidebarMenuButton>
                <MoreHorizontal/>
                <span className="text-sm">More</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Secondary Navigation */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarMenu>
            {data.navSecondary.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={location === item.url}>
                  <Link href={item.url}>
                    <item.icon/>
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={data.user.avatar}
                      alt={user?.name || data.user.name}
                    />
                    <AvatarFallback className="rounded-lg">
                      {(user?.name || data.user.name)
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.name || data.user.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email || data.user.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4"/>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={data.user.avatar}
                        alt={user?.name || data.user.name}
                      />
                      <AvatarFallback className="rounded-lg">
                        {(user?.name || data.user.name)
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.name || data.user.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email || data.user.email}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator/>
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <Sparkles/>
                    Upgrade to Pro
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator/>
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <User/>
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CreditCard/>
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Bell/>
                    Notifications
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings/>
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator/>
                <DropdownMenuItem>
                  <LogOut/>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail/>
    </Sidebar>
  )
}
