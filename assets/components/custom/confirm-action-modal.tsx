import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { memo, useCallback, useEffect, useState } from "react";

export type ConfirmProps = {
	action: () => void | Promise<void>;
	title?: string;
	description?: string;
};

export const ConfirmModal = memo(() => {
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState<string>();
	const [description, setDescription] = useState<string>();
	const [action, setAction] = useState<() => void | Promise<void>>(() => {});

	useEffect(() => {
		const handleEvent = (event: Event) => {
			const customEvent = event as CustomEvent<ConfirmProps>;
			setOpen(true);
			setTitle(customEvent.detail.title);
			setDescription(customEvent.detail.description);
			setAction(() => customEvent.detail.action);
		};
		document.addEventListener("confirm-action", handleEvent);

		return () => document.removeEventListener("confirm-action", handleEvent);
	}, []);

	const cancel = useCallback(() => {
		setOpen(false);
		setTitle(undefined);
		setDescription(undefined);
		setAction(() => {});
	}, []);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title || "Confirm action"}</AlertDialogTitle>
					<AlertDialogDescription>
						{description ||
							"Are you sure you want to go through with this action?"}
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel onClick={cancel}>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={action}>Continue</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
});

export function confirmAction(props: ConfirmProps) {
	document.dispatchEvent(
		new CustomEvent("confirm-action", {
			detail: props,
		}),
	);
}
