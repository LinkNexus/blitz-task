import {ArchiveIcon, MoreHorizontal, Settings, Users} from "lucide-react";
import {type Dispatch, memo, type SetStateAction} from "react";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,} from "@/components/ui/tooltip";
import {useAccount} from "@/hooks/use-account";
import {getInitials} from "@/lib/utils";
import type {ProjectForm} from "@/schemas";
import type {Project} from "@/types";
import {EditableContent} from "../editable-content";
import {IconsPopover} from "../icons-popover";
import {ChangeImageModal} from "./change-image-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {ProjectDescription} from "./project-description";
import {ProjectMembersModal} from "./project-members-modal/project-members-modal";

type Props = {
  project: Project;
  setProject: Dispatch<SetStateAction<Project | null>>;
  update: (data: Partial<ProjectForm>) => Promise<void>;
};

export const ProjectHeader = memo(({project, setProject, update}: Props) => {
  const {user} = useAccount();

  return (
    <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        {/* Main Project Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-4 flex-1">
            <Avatar
              onClick={() =>
                document.dispatchEvent(
                  new CustomEvent("project.image-modal-open"),
                )
              }
              className="cursor-pointer hover:scale-110 transition-transform size-16 sm:size-20 ring-2 ring-border"
            >
              <AvatarImage src={`/api/projects/image/${project.image}`}/>
              <AvatarFallback className="font-bold text-primary text-2xl sm:text-4xl bg-primary/10">
                {getInitials(project.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <IconsPopover
                  onEmojiSelect={async (icon) => {
                    await update({icon});
                  }}
                >
									<span className="text-2xl sm:text-4xl cursor-pointer hover:scale-110 transition-transform">
										{project.icon || "📋"}
									</span>
                </IconsPopover>
                <EditableContent
                  value={project.name}
                  onSave={async (name) => {
                    await update({name});
                  }}
                >
                  <h1
                    className="font-black text-2xl sm:text-4xl text-foreground hover:text-primary transition-colors cursor-pointer">
                    {project.name}
                  </h1>
                </EditableContent>
              </div>
              <ProjectDescription
                description={project.description}
                update={update}
              />
            </div>
          </div>

          {/* Project Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="size-4"/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Settings className="size-4"/>
                  <span>Project Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator/>
                <DropdownMenuItem className="text-destructive">
                  <ArchiveIcon className="size-4 text-destructive"/>
                  <span>Archive Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <div className="flex -space-x-2">
                {project.participants.slice(0, 5).map((participant) => (
                  <TooltipProvider key={participant.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar
                          className="size-8 ring-background ring-2 hover:scale-110 transition-transform cursor-pointer">
                          <AvatarFallback className="text-muted-foreground text-xs">
                            {getInitials(participant.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>{participant.name}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
              {project.participants.length > 5 && (
                <div
                  className="size-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
									<span className="text-xs text-muted-foreground font-medium">
										+{project.participants.length - 5}
									</span>
                </div>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-8 rounded-full"
                  onClick={() => {
                    document.dispatchEvent(
                      new CustomEvent("project.participants-modal-open"),
                    );
                  }}
                >
                  <Users className="size-4"/>
                </Button>
              </TooltipTrigger>
              <TooltipContent>View all participants</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Project Meta & Team */}
        {project.createdBy.id !== user.id && (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="text-xs">
                Created by {project.createdBy.name}
              </Badge>
            </div>
          </div>
        )}
      </div>

      <ChangeImageModal update={update}/>
      <ProjectMembersModal project={project} setProject={setProject}/>
    </div>
  );
});
