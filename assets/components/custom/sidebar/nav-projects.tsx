import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useApiFetch } from "@/hooks/use-api-fetch";
import type { Project } from "@/types";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

type ProjectItem = Pick<Project, "id" | "name" | "icon">;

export function NavProjects() {
	const [projects, setProjects] = useState<ProjectItem[] | null>(null);

	const { pending, action: fetchProjects } = useApiFetch<ProjectItem[]>({
		url: "/api/projects",
		options: {
			onSuccess(res) {
				setProjects(res.data);
			},
			onError(err) {
				console.log(err);
				setProjects([]);
			},
		},
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		fetchProjects();

		function addProject(e: Event) {
			const project = (e as CustomEvent).detail as ProjectItem;
			setProjects((prev) => {
				return prev ? [project, ...prev] : [project];
			});
		}

		function updateProject(e: Event) {
			const updatedProject = (e as CustomEvent).detail as ProjectItem;
			setProjects((prev) => {
				if (!prev) return prev;
				return prev.map((p) =>
					p.id === updatedProject.id ? updatedProject : p,
				);
			});
		}

		document.addEventListener("project.created", addProject);
		document.addEventListener("project.updated", updateProject);

		return () => {
			document.removeEventListener("project.created", addProject);
			document.removeEventListener("project.updated", updateProject);
		};
	}, []);

	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel>Projects</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{pending && (
						<SidebarMenuItem>
							<Loader2 className="animate-spin m-auto" />
						</SidebarMenuItem>
					)}
					{projects?.map((p) => (
						<SidebarMenuItem key={p.id}>
							<SidebarMenuButton asChild>
								<Link href={`/projects/${p.id}`}>
									{p.icon && p.icon !== "" && <span>{p.icon}</span>}
									<span>{p.name}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
					<SidebarMenuItem>
						<SidebarMenuButton
							className="text-shadow-sidebar-foreground/70"
							onClick={() =>
								document.dispatchEvent(new Event("project.open-modal"))
							}
						>
							<Plus />
							<span>Add</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton className="text-shadow-sidebar-foreground/70">
							<MoreHorizontal />
							<span>More</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
