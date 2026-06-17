import { zodResolver } from "@hookform/resolvers/zod";
import { IconArrowLeft } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import type { ProjectDetails } from "@/api";
import {
  createProjectMutation,
  getProjectQueryKey,
} from "@/api/@tanstack/react-query.gen";
import { DatePickerField } from "@/components/forms/fields/date-picker";
import { DropzoneField } from "@/components/forms/fields/dropzone";
import { InputField } from "@/components/forms/fields/input";
import { TextCollectionField } from "@/components/forms/fields/text-collection";
import { TextareaField } from "@/components/forms/fields/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useAccount } from "@/hooks/use-current-user";
import { Route as DashboardRoute } from "../dashboard";

export const CreateProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(255, "Project name must be at most 255 characters long"),
  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters long"),
  startDate: z.iso.datetime().nullable(),
  dueDate: z.iso.datetime().nullable(),
  tags: z.array(z.string().max(50)).max(10, "Maximum 10 tags allowed"),
  image: z
    .file()
    .max(350_000)
    .mime(["image/png", "image/jpeg", "image/svg+xml", "image/webp"])
    .nullable(),
});

export const Route = createFileRoute("/_app/projects/create")({
  component: CreateProjectPage,
});

function CreateProjectPage() {
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAccount();

  const form = useForm({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: new Date().toISOString(),
      dueDate: null,
      tags: [],
      image: null,
    },
  });

  const createProjectMut = useMutation({
    ...createProjectMutation(),
    onSuccess: async (project: ProjectDetails) => {
      queryClient.setQueryData(
        getProjectQueryKey({
          path: { projectId: Number(project.id) },
        }),
        project,
      );

      await navigate({
        to: "/projects/$projectId",
        params: { projectId: String(project.id) },
      });
    },
    onError: (error) => {
      if (error && "errors" in error && error.errors) {
        error.errors.forEach((e) => {
          form.setError(e.path as keyof z.infer<typeof CreateProjectSchema>, {
            message: e.message,
          });
        });
      }
    },
  });

  const isFormDisabled = !user.emailConfirmed;

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <Link
          to={DashboardRoute.to}
          onClick={() => navigate({ to: "/dashboard" })}
          className="mb-4 flex items-center hover:underline underline-offset-2"
        >
          <IconArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold">Create New Project</h1>
        <p className="mt-2">
          Set up your project with all the details needed to get started
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit((formData) =>
          createProjectMut.mutate({ body: formData }),
        )}
        className="space-y-6"
      >
        <FieldGroup>
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
                inputProps={{ rows: 7, disabled: isFormDisabled }}
                fieldState={fieldState}
                labelProps={{ children: "Project Description" }}
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

          <Controller
            name="image"
            control={form.control}
            render={({ field, fieldState }) => (
              <DropzoneField
                field={field}
                fieldState={fieldState}
                labelProps={{ children: "Project Image" }}
                inputProps={{
                  accept: {
                    "image/png": [".png"],
                    "image/jpeg": [".jpg", ".jpeg"],
                    "image/svg+xml": [".svg"],
                    "image/webp": [".webp"],
                  },
                  maxSize: 3 * 1024 * 1024,
                  multiple: false,
                  onDrop: (file) => {
                    field.onChange(file[0] || null);
                  },
                  disabled: isFormDisabled,
                }}
              />
            )}
          />

          <Field>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || isFormDisabled}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Spinner /> Creating project...
                </>
              ) : (
                "Create project"
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </>
  );
}
