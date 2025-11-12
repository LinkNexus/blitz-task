import { useState } from "react";
import { toast } from "sonner";
import { navigate } from "wouter/use-browser-location";
import type { ProjectForm } from "@/schemas";
import type { FormErrors, Project } from "@/types";
import { useApiFetch, type UseApiFetchAction } from "./use-api-fetch";

export type UseProjectReturn = {
	project: Project | null;
	setProject: React.Dispatch<React.SetStateAction<Project | null>>;
	gettingProject: boolean;
	getProject: UseApiFetchAction<never>;
	updatingProject: boolean;
	updateProject: UseApiFetchAction<FormData | ProjectForm>;
};

export function useProject(id: number): UseProjectReturn {
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
			invalidationTime: false,
		},
		deps: [id],
	});

	const { pending: updatingProject, action: updateProject } = useApiFetch<
		Project,
		FormErrors,
		ProjectForm | FormData
	>({
		url: `/api/projects/${id}`,
		options: {
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
			invalidationTime: false,
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
