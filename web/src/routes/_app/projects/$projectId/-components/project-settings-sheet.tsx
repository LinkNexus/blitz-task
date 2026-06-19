import { zodResolver } from "@hookform/resolvers/zod";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";
import type { ProjectDetails } from "@/api";
import {
  getProjectQueryKey,
  updateProjectMutation,
} from "@/api/@tanstack/react-query.gen";
import { DatePickerField } from "@/components/forms/fields/date-picker";
import { DropzoneField } from "@/components/forms/fields/dropzone";
import { InputField } from "@/components/forms/fields/input";
import { TextCollectionField } from "@/components/forms/fields/text-collection";
import { TextareaField } from "@/components/forms/fields/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useAccount } from "@/hooks/use-current-user";
import { getInitials, imageFormats } from "@/lib/utils";
import { ProjectSchema } from "../-schemas";
import { ProjectMembersSection } from "./project-members-section";

type Props = {
  project: ProjectDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FORM_ID = "project-settings-form";

export function ProjectSettingsSheet({ project, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAccount();

  const form = useForm({
    resolver: zodResolver(ProjectSchema),
    defaultValues: {
      name: project.name,
      description: project.description,
      startDate: project.startDate ?? null,
      dueDate: project.dueDate ?? null,
      tags: project.tags,
      image: null,
    },
  });

  const updateProjectMut = useMutation({
    ...updateProjectMutation(),
    onSuccess: async (updated: ProjectDetails) => {
      queryClient.setQueryData(
        getProjectQueryKey({ path: { projectId: Number(updated.id) } }),
        updated,
      );
      toast.success("Project updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      if ("errors" in error) {
        error.errors.forEach((e) => {
          form.setError(e.path as keyof z.infer<typeof ProjectSchema>, {
            message: e.message,
          });
        });
      } else {
        toast.error(
          "An error occurred when trying to update the project information",
          { description: error.message },
        );
      }
    },
  });

  const isFormDisabled = !currentUser.emailConfirmed;
  const watchedImage = form.watch("image");

  const onSubmit = (data: z.infer<typeof ProjectSchema>) => {
    updateProjectMut.mutate({
      body: data,
      path: { projectId: Number(project.id) },
    });
  };

  const handleDelete = () => {
    // TODO: wire to DELETE /api/projects/{projectId} when endpoint is ready
    toast.info("Project deletion coming soon");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b p-6 pb-4">
          <SheetTitle>Project Settings</SheetTitle>
          <SheetDescription>
            Update your project details and configuration.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body — three independent sections */}
        <div className="flex-1 overflow-y-auto">
          {/* ── General settings ── */}
          <div className="p-6">
            <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
                {/* Image preview + upload */}
                <Field>
                  <div className="mb-3 flex items-center gap-4">
                    <Avatar className="size-16 shrink-0 rounded-xl">
                      {!watchedImage && project.imageId && (
                        <AvatarImage
                          className="object-cover"
                          src={`/api/projects/${project.id}/attachments/${project.imageId}`}
                        />
                      )}
                      <AvatarFallback className="rounded-xl bg-primary/10 text-lg font-semibold text-primary">
                        {getInitials(project.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Project Image</p>
                      <p className="text-xs text-muted-foreground">
                        {watchedImage
                          ? `Selected: ${watchedImage.name}`
                          : project.imageId
                            ? "Drop a new image below to replace it"
                            : "Add an image to represent this project"}
                      </p>
                    </div>
                  </div>

                  <Controller
                    name="image"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <DropzoneField
                        field={field}
                        fieldState={fieldState}
                        labelProps={{
                          className: "sr-only",
                          children: "Project Image",
                        }}
                        inputProps={{
                          accept: imageFormats,
                          disabled: isFormDisabled,
                          maxSize: 350_000,
                          multiple: false,
                          onDrop: (files) => {
                            field.onChange(files[0] ?? null);
                          },
                        }}
                      />
                    )}
                  />
                </Field>

                <Controller
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <InputField
                      field={field}
                      fieldState={fieldState}
                      labelProps={{ children: "Project Name" }}
                      inputProps={{ disabled: isFormDisabled }}
                    />
                  )}
                />

                <Controller
                  control={form.control}
                  name="description"
                  render={({ field, fieldState }) => (
                    <TextareaField
                      field={field}
                      inputProps={{ rows: 4, disabled: isFormDisabled }}
                      fieldState={fieldState}
                      labelProps={{ children: "Description" }}
                    />
                  )}
                />

                <Controller
                  control={form.control}
                  name="tags"
                  render={({ field, fieldState }) => (
                    <TextCollectionField
                      field={field}
                      fieldState={fieldState}
                      labelProps={{ children: "Tags" }}
                      inputProps={{ disabled: isFormDisabled }}
                    />
                  )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Controller
                    control={form.control}
                    name="startDate"
                    render={({ field, fieldState }) => (
                      <DatePickerField
                        field={field}
                        fieldState={fieldState}
                        labelProps={{ children: "Start Date" }}
                        inputProps={{ disabled: isFormDisabled }}
                      />
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="dueDate"
                    render={({ field, fieldState }) => (
                      <DatePickerField
                        field={field}
                        fieldState={fieldState}
                        labelProps={{ children: "Due Date" }}
                        inputProps={{ disabled: isFormDisabled }}
                      />
                    )}
                  />
                </div>
              </FieldGroup>
            </form>
          </div>

          <Separator />

          {/* ── Members ── */}
          <div className="p-6">
            <ProjectMembersSection
              project={project}
              currentUser={currentUser}
            />
          </div>

          <Separator />

          {/* ── Danger Zone ── */}
          <div className="p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <IconAlertTriangle className="size-4 text-destructive" />
                <h3 className="text-sm font-semibold text-destructive">
                  Danger Zone
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Deleting a project is permanent and cannot be undone. All tasks
                and attachments will be removed.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" size="sm">
                    Delete Project
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete "{project.name}"?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. All project data, tasks, and
                      attachments will be permanently removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleDelete}
                    >
                      Delete Project
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* Footer — Save is linked to the settings form via id */}
        <SheetFooter className="flex-row justify-end gap-3 border-t p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <>
                <Spinner /> Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
