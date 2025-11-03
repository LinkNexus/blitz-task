import { memo, useState } from "react";
import Markdown from "react-markdown";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectForm } from "@/schemas";
import remarkGfm from "remark-gfm";

type Props = {
	description: string | null;
	update: (data: Partial<ProjectForm>) => Promise<void>;
};

export const ProjectDescription = memo(({ description, update }: Props) => {
	const [editing, setEditing] = useState(false);

	if (editing) {
		return (
			<Textarea
				className="!bg-transparent border-none !focus:ring-0 resize-none prose dark:prose-invert sm:text-base h-24"
				defaultValue={description || ""}
				autoFocus
				onBlur={async (e) => {
					setEditing(false);
					await update({ description: e.target.value });
				}}
			/>
		);
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: <explanation>
		// biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
		<div
			onClick={() => setEditing(true)}
			className="prose dark:prose-invert text-muted-foreground text-sm sm:text-base"
		>
			{description && description.trim() !== "" ? (
				<Markdown remarkPlugins={[remarkGfm]}>{description}</Markdown>
			) : (
				"No description provided."
			)}{" "}
		</div>
	);
});
