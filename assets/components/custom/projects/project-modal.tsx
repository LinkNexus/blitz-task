import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { navigate } from "wouter/use-browser-location";
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
	EmojiPicker,
	EmojiPickerContent,
	EmojiPickerFooter,
	EmojiPickerSearch,
} from "@/components/ui/emoji-picker";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Dropzone,
	DropzoneContent,
	DropzoneEmptyState,
} from "@/components/ui/shadcn-io/dropzone";
import { Textarea } from "@/components/ui/textarea";
import { useApiFetch } from "@/hooks/use-api-fetch";
import { toFormData } from "@/lib/utils";
import type { FormErrors, Project } from "@/types";
import { type ProjectForm, projectSchema } from "@/schemas";

export const ProjectModal = memo(() => {
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		document.addEventListener("project.open-modal", () => setIsOpen(true));
	});

	const form = useForm<ProjectForm>({
		resolver: zodResolver(projectSchema),
		defaultValues: {
			icon: undefined,
			name: "",
			description: "",
		},
		mode: "onBlur",
	});

	const { reset, setValue } = form;

	const closeModalAndReset = useCallback(() => {
		setIsOpen(false);
		reset({
			icon: undefined,
			name: "",
			description: "",
			image: undefined,
		});
	}, [reset]);

	const { pending, action: createProject } = useApiFetch<
		Project,
		FormErrors,
		FormData
	>({
		url: "/api/projects",
		options: {
			onSuccess(res) {
				const { data: project } = res;
				document.dispatchEvent(
					new CustomEvent("project.created", { detail: project }),
				);
				navigate(`/projects/${project.id}`);
				closeModalAndReset();
			},
		},
		deps: [closeModalAndReset],
	});

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Create a new Project</DialogTitle>
					<DialogDescription>
						Start organizing your tasks by creating a new project
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(async (data) =>
							createProject({ data: toFormData(data) }),
						)}
						className="space-y-6"
					>
						<FormField
							control={form.control}
							name="icon"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Project Icon</FormLabel>
									<div className="flex gap-x-2">
										<FormControl>
											<Input {...field} disabled={pending} />
										</FormControl>

										<Popover>
											<PopoverTrigger asChild>
												<Button type="button" variant="outline">
													Icons
												</Button>
											</PopoverTrigger>
											<PopoverContent>
												<EmojiPicker
													className="h-[342px]"
													onEmojiSelect={({ emoji }) => setValue("icon", emoji)}
												>
													<EmojiPickerSearch />
													<EmojiPickerContent />
													<EmojiPickerFooter />
												</EmojiPicker>
											</PopoverContent>
										</Popover>
									</div>
									<FormDescription>
										A single character or emoji to represent your project
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Project Name</FormLabel>
									<FormControl>
										<Input {...field} disabled={pending} />
									</FormControl>
									<FormDescription>
										Choose a clear and descriptive name for your project
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											className="min-h-24"
											{...field}
											disabled={pending}
										/>
									</FormControl>
									<FormDescription>
										Provide a detailed description of your project's goals and
										scope
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							name="image"
							control={form.control}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Project Image</FormLabel>
									<FormControl>
										<Dropzone
											accept={{ "image/*": [] }}
											onDrop={(files) => {
												field.onChange(files[0]);
											}}
											multiple={false}
											src={field.value ? [field.value] : []}
											maxSize={1.5 * 1024 * 1024}
											onError={(e) =>
												toast.error("Something went wrong: " + e.message)
											}
										>
											<DropzoneEmptyState />
											<DropzoneContent />
										</Dropzone>
									</FormControl>
									<FormDescription>
										The image will be used as a visual representation of your
										project
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter className="flex justify-end gap-x-3">
							<Button
								type="button"
								variant="outline"
								disabled={pending}
								onClick={closeModalAndReset}
							>
								Cancel
							</Button>

							<Button type="submit" disabled={pending}>
								{pending ? (
									<>
										<Loader2 className="animate-spin" />
										Creating...
									</>
								) : (
									<>
										<Plus />
										Create
									</>
								)}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
});
