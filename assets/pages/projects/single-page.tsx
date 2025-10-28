import { Loader, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "wouter";
import { useProject } from "@/hooks/use-project";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { IconsPopover } from "@/components/custom/icons-popover";
import { EditableContent } from "@/components/custom/editable-content";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export function ProjectPage() {
	const { id } = useParams<{ id: string }>();
	const { gettingProject, getProject, project, updateProject } = useProject(
		Number(id),
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		getProject();
	}, []);

	if (gettingProject || !project) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<Loader className="animate-spin size-10" />
			</div>
		);
	}

	return (
		<div>
			<div className="flex items-center gap-x-4">
				<Avatar className="size-20">
					<AvatarImage src={`/api/projects/image/${project.id}`} />
					<AvatarFallback className="font-bold text-yellow-400 text-4xl">
						{getInitials(project.name)}
					</AvatarFallback>
				</Avatar>
				<div className="flex flex-col gap-y-3">
					<div className="flex text-4xl items-center gap-x-3">
						<IconsPopover
							onEmojiSelect={(icon) => {
								updateProject({ data: { ...project, icon } });
							}}
						>
							<span>{project.icon}</span>
						</IconsPopover>
						<EditableContent
							value={project.name}
							onSave={(name) => {
								updateProject({ data: { ...project, name } });
							}}
						>
							<h1 className="font-black"></h1>
						</EditableContent>
					</div>
					<p className="text-muted-foreground">{project.description}</p>
				</div>
			</div>
		</div>
	);
}
