import {Filter, Loader, Plus, Search} from "lucide-react";
import {memo, useCallback, useEffect} from "react";
import {useParams} from "wouter";
import {ProjectHeader} from "@/components/custom/projects/project-header";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useProject} from "@/hooks/use-project";
import {toFormData} from "@/lib/utils";
import type {ProjectForm} from "@/schemas";
import {KanbanBoard} from "@/components/custom/projects/kanban-board/kanban-board";

export const ProjectPage = memo(() => {
  const {id} = useParams<{ id: string }>();
  const {setProject, gettingProject, getProject, project, updateProject} =
    useProject(Number(id));
  const update = useCallback(
    async (data: Partial<ProjectForm>) => {
      if (project) {
        const dataToBeSent = {
          name: project.name,
          description: project.description,
          icon: project.icon,
          ...data,
        };
        await updateProject({
          data: data.image ? toFormData(dataToBeSent) : dataToBeSent,
        });
      }
    },
    [project, updateProject],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    getProject();
  }, [id]);

  if (gettingProject || !project) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader className="animate-spin size-10"/>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Project Header */}
      <ProjectHeader
        project={project}
        setProject={setProject}
        update={update}
      />

      {/* Toolbar - Fixed */}
      <div className="border-b bg-muted/30 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-3 p-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto sm:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground"/>
              <Input
                placeholder="Search tasks..."
                className="pl-10 bg-background"
              />
            </div>
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <Filter className="size-4"/>
              <span className="hidden sm:inline">Filter</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button size="sm" className="flex-shrink-0">
              <Plus className="size-4"/>
              New Task
            </Button>
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <Plus className="size-4"/>
              New Column
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area - Kanban Board Container with proper overflow */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <KanbanBoard id={project.id} participants={project.participants}/>
        </div>
      </div>
    </div>
  );
});
