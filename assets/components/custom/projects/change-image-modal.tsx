import { memo, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Dropzone,
	DropzoneContent,
	DropzoneEmptyState,
} from "@/components/ui/shadcn-io/dropzone";
import type { ProjectForm } from "@/schemas";

type Props = {
	update: (data: Partial<ProjectForm>) => Promise<void>;
};

export const ChangeImageModal = memo(({ update }: Props) => {
	const [files, setFiles] = useState<File[]>([]);
	const [open, setOpen] = useState(false);

	const upload = useCallback(async () => {
		await update({ image: files[0] }).then(() => setOpen(false));
	}, [files, update]);

	useEffect(() => {
		document.addEventListener("project.image-modal-open", () => {
			setOpen(true);
		});
	}, []);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Create a new Project</DialogTitle>
					<DialogDescription>
						Start organizing your tasks by creating a new project
					</DialogDescription>
				</DialogHeader>

				<Dropzone
					accept={{ "image/*": [] }}
					onDrop={(files) => {
						setFiles(files);
					}}
					multiple={false}
					src={files.length < 1 ? undefined : files}
					maxSize={1.5 * 1024 * 1024}
					onError={(e) => toast.error(`Something went wrong: ${e.message}`)}
					className="min-h-[300px]"
				>
					<DropzoneEmptyState />
					<DropzoneContent />
				</Dropzone>

				<DialogFooter>
					<Button
						variant="outline"
						className="mr-2"
						onClick={() => {
							setOpen(false);
							setFiles([]);
						}}
					>
						Cancel
					</Button>
					<Button disabled={files.length < 1} onClick={upload}>
						Change Image
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
});
