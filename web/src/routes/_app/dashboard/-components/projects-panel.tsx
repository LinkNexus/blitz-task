import { IconLayoutKanban, IconPlus, IconUsers } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ProjectSummary } from "@/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RoleBadge } from "@/routes/_app/projects/-components/role-badge";

/** The list is already most-recently-touched first, so the head of it is the useful part. */
const MAX_PROJECTS = 5;

function ProjectRow({ project }: { project: ProjectSummary }) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: String(project.id) }}
      className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-muted/50"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{project.name}</p>
        <div className="mt-0.5 flex items-center gap-x-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <IconLayoutKanban className="size-3.5 shrink-0" />
            {project.tasksCount}
          </span>
          <span className="flex items-center gap-1">
            <IconUsers className="size-3.5 shrink-0" />
            {project.participantsCount}
          </span>
        </div>
      </div>
      <RoleBadge role={project.role} />
    </Link>
  );
}

export function ProjectsPanel({ projects }: { projects: ProjectSummary[] }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold">Projects</h2>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild>
          <Link to="/projects/create">
            <IconPlus className="size-3.5" />
            New
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          You aren't in any projects yet. Create one to get started.
        </p>
      ) : (
        <div className="space-y-0.5">
          {projects.slice(0, MAX_PROJECTS).map((project) => (
            <ProjectRow key={String(project.id)} project={project} />
          ))}
        </div>
      )}
    </Card>
  );
}
