import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { memo } from "react";
import type { ProjectSummary } from "@/api";
import { listProjectsOptions } from "@/api/@tanstack/react-query.gen";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { Route as CreateProjectRoute } from "@/routes/_app/projects/create";

/** First letters of the project name, for the tile that stands in for a project icon. */
function initials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ProjectItem({
  project,
  isActive,
}: {
  project: ProjectSummary;
  isActive: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={{
          children: (
            <div className="space-y-1">
              <p className="font-medium">{project.name}</p>
              <p className="text-xs text-muted-foreground">
                {project.tasksCount}{" "}
                {project.tasksCount === 1 ? "task" : "tasks"}
              </p>
            </div>
          ),
        }}
      >
        <Link
          to="/projects/$projectId"
          params={{ projectId: String(project.id) }}
        >
          <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-primary/10 text-[9px] font-semibold text-primary">
            {initials(project.name)}
          </span>
          <span className="truncate text-sm font-medium">{project.name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export const NavProjects = memo(() => {
  const location = useLocation();

  // useQuery, not useSuspenseQuery: this sidebar renders on every authenticated page and sits
  // outside any Suspense boundary, so suspending here would blank the whole app shell on each
  // navigation. A slow project list should degrade to skeletons, not take the layout with it.
  const {
    data: projects,
    isPending,
    isError,
  } = useQuery(listProjectsOptions());

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="text-xs font-semibold">
        Projects
      </SidebarGroupLabel>

      <SidebarMenu>
        {isPending &&
          [0, 1, 2].map((row) => (
            <SidebarMenuItem key={row}>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
          ))}

        {/* Silent on error rather than an alert in the chrome of every page: the list is
            navigation, not content, and the route the user is actually on reports its own
            failures. A 401 is already intercepted globally and redirects to /login. */}
        {projects?.map((project) => (
          <ProjectItem
            key={String(project.id)}
            project={project}
            isActive={location.pathname.startsWith(
              `/projects/${String(project.id)}`,
            )}
          />
        ))}

        {!isPending && !isError && projects?.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No projects yet.
          </p>
        )}

        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            className="text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
            tooltip="Create a new project"
          >
            <Link
              to={CreateProjectRoute.to}
              className="flex items-center gap-2"
            >
              <IconPlus className="h-4 w-4" />
              <span className="text-sm font-medium">Create Project</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
});
