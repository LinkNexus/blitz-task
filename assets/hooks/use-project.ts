import { useState } from "react";
import { toast } from "sonner";
import { navigate } from "wouter/use-browser-location";
import type { FormErrors, Project } from "@/types";
import { useApiFetch } from "./use-api-fetch";
import type { ProjectForm } from "@/schemas";

export function useProject(id: number) {
	const [project, setProject] = useState<Project | null>(null);

	const { pending: gettingProject, action: getProject } = useApiFetch<Project>({
		url: `/api/projects/${id}`,
		options: {
			onSuccess(response) {
				setProject(response.data);
			},

			onError() {
				toast.error("Failed to load project data.");
				navigate("/projects");
			},
		},
		deps: [id],
	});

	const { pending: updatingProject, action: updateProject } = useApiFetch<
		Project,
		FormErrors,
		ProjectForm
	>({
		url: `/api/projects/${id}`,
		options: {
			method: "PUT",
			onSuccess(response) {
				setProject(response.data);
				document.dispatchEvent(
					new CustomEvent("project.updated", { detail: response.data }),
				);
			},
			onError(err) {
				err.response.data.violations.forEach((v) => {
					console.log(`${v.propertyPath}: ${v.title}`);
				});
				toast.error("Failed to update project");
			},
		},
	});

	return {
		project,
		setProject,
		gettingProject,
		getProject,
		updatingProject,
		updateProject,
	};
}
