import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconAlertTriangle,
  IconSettings2,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccount } from "@/hooks/use-current-user";
import { cn, getInitials, imageFormats } from "@/lib/utils";
import { MAX_PROJECT_IMAGE_SIZE, ProjectSchema } from "../-schemas";
import { ProjectMembersSection } from "./project-members";

type Props = {
  project: ProjectDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function DangerRow({
  title,
  titleClassName,
  description,
  action,
}: {
  title: string;
  titleClassName?: string;
  description: string;
  action: JSX.Element;
}) {
  return (
    <div className="flex flex-col gap-3 border-b p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h4
          className={cn(
            "text-sm font-semibold",
            titleClassName ?? "text-destructive",
          )}
        >
          {title}
        </h4>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

const FORM_ID = "project-settings-form";

export function ProjectSettingsSheet({ project, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAccount();
  const [activeTab, setActiveTab] = useState("general");

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
      error.errors.forEach((e) => {
        form.setError(e.path as keyof z.infer<typeof ProjectSchema>, {
          message: e.message,
        });
      });
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

  const canDelete =
    project.userPermissions?.includes("DeleteProject") ?? false;
  const canEditProject =
    project.userPermissions?.includes("EditProject") ?? false;
  const isOwner = canDelete;

  const handleArchive = () => {
    // TODO: wire to POST /api/projects/{projectId}/archive when endpoint is ready
    toast.info("Project archiving coming soon");
  };

  const handleLeave = () => {
    // TODO: wire to DELETE /api/projects/{projectId}/members/me when endpoint is ready
    toast.info("Leave project coming soon");
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
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Project Settings</SheetTitle>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col gap-0 overflow-hidden"
        >
          {/* Tab bar — pinned below the header, never scrolls */}
          <TabsList
            variant="line"
            className="h-auto w-full shrink-0 justify-start rounded-none border-b px-6 pb-0"
          >
            <TabsTrigger value="general" className="flex items-center gap-1.5">
              <IconSettings2 className="size-3.5" />
              General
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5">
              <IconUsers className="size-3.5" />
              Members
              <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground tabular-nums">
                {project.participants.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="danger"
              className="gap-1.5 data-[state=active]:text-destructive"
            >
              <IconAlertTriangle className="size-3.5" />
              Danger Zone
            </TabsTrigger>
          </TabsList>

          {/* ── General ── */}
          <TabsContent
            value="general"
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-6">
              <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
                <FieldGroup>
                  {/* Image preview + upload */}
                  <Field>
                    <div className="mb-3 flex items-center gap-4">
                      <Avatar className="size-16 shrink-0 rounded-xl">
                        {project.imageId && (
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
                            maxSize: MAX_PROJECT_IMAGE_SIZE,
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

            {/* Footer lives inside the General tab so it disappears on other tabs */}
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
          </TabsContent>

          {/* ── Members ── */}
          <TabsContent value="members" className="flex-1 overflow-y-auto p-6">
            <ProjectMembersSection
              project={project}
              currentUser={currentUser}
            />
          </TabsContent>

          {/* ── Danger Zone ── */}
          <TabsContent value="danger" className="flex-1 overflow-y-auto p-6">
            <div className="overflow-hidden rounded-lg border">
              {canEditProject && (
                <DangerRow
                  title="Archive Project"
                  titleClassName="text-amber-600 dark:text-amber-400"
                  description={`Hide "${project.name}" from active views. All data is preserved and the project can be restored at any time.`}
                  action={
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-400"
                        >
                          Archive Project
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Archive "{project.name}"?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            The project will be hidden from active views but all
                            data will be preserved. You can restore it later from
                            your archived projects.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-amber-600 text-white hover:bg-amber-700"
                            onClick={handleArchive}
                          >
                            Archive Project
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  }
                />
              )}

              {!isOwner && (
                <DangerRow
                  title="Leave Project"
                  description={`Remove yourself from "${project.name}". You will lose access to all project data and will need to be re-invited to rejoin.`}
                  action={
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          Leave Project
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Leave "{project.name}"?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            You will be removed from this project and lose access
                            to all its data. A project manager will need to
                            re-invite you to regain access.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleLeave}
                          >
                            Leave Project
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  }
                />
              )}

              {canDelete && (
                <DangerRow
                  title="Delete Project"
                  description={`Permanently delete "${project.name}" and all of its tasks, attachments, and member data. This action cannot be undone.`}
                  action={
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
                            This action cannot be undone. All project data, tasks,
                            and attachments will be permanently removed.
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
                  }
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
