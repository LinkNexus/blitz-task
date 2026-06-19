import { IconCalendarEvent, IconSettings2 } from "@tabler/icons-react";
import { useState } from "react";
import type { ProjectDetails } from "@/api";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";
import { ProjectSettingsSheet } from "./project-settings-sheet";

type Props = {
  project: ProjectDetails;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const ProjectHeader = ({ project }: Props) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <ProjectSettingsSheet
        project={project}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
      <div className="space-y-3">
        {/* Title row — avatar shrinks on mobile, title size drops one step */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Avatar className="size-10 sm:size-14 shrink-0 rounded-xl">
              {project.imageId && (
                <AvatarImage
                  className="object-cover"
                  src={`/api/projects/${project.id}/attachments/${project.imageId}`}
                />
              )}
              <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-base sm:text-lg">
                {getInitials(project.name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 pt-0.5">
              <h1 className="text-lg sm:text-2xl font-bold leading-tight truncate">
                {project.name}
              </h1>
              {project.description && (
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {project.description}
                </p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="icon-sm"
            className="shrink-0 mt-0.5"
            onClick={() => setSettingsOpen(true)}
          >
            <IconSettings2 />
          </Button>
        </div>

        {/* Meta — stacks vertically on mobile, flows in a row on sm+ */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2 text-sm text-muted-foreground">
          {(project.startDate || project.dueDate) && (
            <div className="flex items-center gap-1.5">
              <IconCalendarEvent className="size-4 shrink-0" />
              <span className="text-xs sm:text-sm">
                {project.startDate ? formatDate(project.startDate) : "No start"}
                {" – "}
                {project.dueDate ? formatDate(project.dueDate) : "No end"}
              </span>
            </div>
          )}

          {project.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {project.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {project.participants.length > 0 && (
            <div className="sm:ml-auto flex items-center">
              <AvatarGroup>
                {project.participants.slice(0, 4).map((p) => (
                  <Tooltip key={String(p.userId)}>
                    <TooltipTrigger asChild>
                      <Avatar size="sm">
                        <AvatarFallback>{getInitials(p.name)}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>{p.name}</TooltipContent>
                  </Tooltip>
                ))}
                {project.participants.length > 4 && (
                  <AvatarGroupCount>
                    +{project.participants.length - 4}
                  </AvatarGroupCount>
                )}
              </AvatarGroup>
            </div>
          )}
        </div>

        <Separator />
      </div>
    </>
  );
};
