import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar.tsx";
import {Archive, Folder, MoreHorizontal, Share, Star, Trash2} from "lucide-react";
import {Link} from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.tsx";

const favorites = [
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
];

export function Favorites() {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>
        <div className="flex items-center gap-x-2">
          <Star className="size-3"/>
          Favorites
        </div>
      </SidebarGroupLabel>
      <SidebarMenu>
        {favorites.map((item) => (
          <FavoriteItem key={item.name} item={item}/>
        ))}
        <SidebarMenuItem className="text-muted-foreground">
          <SidebarMenuButton>
            <MoreHorizontal/>
            <span className="text-sm">More</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

function FavoriteItem({item}: { item: any }) {
  const [location] = useLocation();
  return (
    <SidebarMenuItem key={item.name}>
      <SidebarMenuButton asChild isActive={location === item.url}>
        <Link href={item.url}>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{item.name}</span>
          </div>
          {item.status === "archived" && (
            <Archive className="ml-auto text-muted-foreground"/>
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
  )
}
