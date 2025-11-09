import { Filter, Loader, Plus, Search } from "lucide-react";
import { memo, useCallback, useEffect } from "react";
import { useParams } from "wouter";
import { ProjectHeader } from "@/components/custom/projects/project-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useProject } from "@/hooks/use-project";
import { toFormData } from "@/lib/utils";
import type { ProjectForm } from "@/schemas";

export const ProjectPage = memo(() => {
	const { id } = useParams<{ id: string }>();
	const { setProject, gettingProject, getProject, project, updateProject } =
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
				<Loader className="animate-spin size-10" />
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full max-h-screen overflow-hidden">
			{/* Project Header */}
			<ProjectHeader
				project={project}
				setProject={setProject}
				update={update}
			/>

			{/* Toolbar */}
			<div className="border-b bg-muted/30">
				<div className="flex flex-col sm:flex-row gap-3 p-4 items-start sm:items-center justify-between">
					<div className="flex items-center gap-2 flex-1 max-w-md">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
							<Input
								placeholder="Search tasks..."
								className="pl-10 bg-background"
							/>
						</div>
						<Button variant="outline" size="sm">
							<Filter className="size-4" />
							<span className="hidden sm:inline">Filter</span>
						</Button>
					</div>

					<div className="flex items-center gap-2">
						<Button size="sm">
							<Plus className="size-4" />
							New Task
						</Button>
						<Button variant="outline" size="sm">
							<Plus className="size-4" />
							New Column
						</Button>
					</div>
				</div>
			</div>

			{/* Main Content Area - Kanban Board Container */}
			<div className="flex-1 overflow-hidden">
				<div className="h-full p-4 lg:p-6">
					{/* Kanban Board Placeholder */}
					<Card className="h-full border-dashed border-2 border-muted-foreground/20">
						<CardHeader className="text-center">
							<h3 className="text-lg font-semibold text-muted-foreground">
								Kanban Board
							</h3>
							<p className="text-sm text-muted-foreground">
								The kanban board will be implemented here
							</p>
						</CardHeader>
						<CardContent className="flex-1 flex items-center justify-center">
							<div className="text-center space-y-4">
								<div className="w-24 h-24 mx-auto bg-muted rounded-lg flex items-center justify-center">
									<div className="w-12 h-12 bg-primary/20 rounded flex items-center justify-center">
										<div className="w-6 h-6 bg-primary/40 rounded-sm"></div>
									</div>
								</div>
								<div className="space-y-2">
									<p className="text-sm font-medium">
										Ready for Kanban Implementation
									</p>
									<p className="text-xs text-muted-foreground max-w-sm">
										This area is prepared for the kanban board component. The
										layout is responsive and will adapt to different screen
										sizes.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
});
