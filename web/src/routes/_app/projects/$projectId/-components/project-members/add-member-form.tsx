import { zodResolver } from "@hookform/resolvers/zod";
import { IconUserPlus } from "@tabler/icons-react";
import { QueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { addProjectMember, type ProjectDetails } from "@/api";
import { getProjectOptions } from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  project: ProjectDetails;
  assignableRoles: readonly string[];
};

const AddProjectMemberSchema = z.object({
  email: z.email("Invalid email address"),
  role: z.enum(["Collaborator", "Contributor", "Viewer"] as const),
});

export function AddProjectMemberForm({ project, assignableRoles }: Props) {
  const { queryClient } = useRouteContext({
    from: "__root__",
  });
  const form = useForm({
    resolver: zodResolver(AddProjectMemberSchema),
    defaultValues: {
      email: "",
      role: "Contributor" as const,
    },
  });

  const onSubmit = async (_data: z.infer<typeof AddProjectMemberSchema>) => {
    const { data, error } = await addProjectMember({
      path: {
        projectId: Number(project.id),
      },
      body: _data,
    });

    if (error) {
      if ("message" in error) {
        toast.error("An error occurred while adding the project member", {
          description: error.message,
        });
      } else {
        error.errors.forEach((e) => {
          toast.error(
            `Form error on filed ${e.path} while adding the project member`,
            {
              description: e.message,
            },
          );
        });
      }
      return;
    }

    queryClient.setQueryData(
      getProjectOptions({
        path: {
          projectId: Number(project.id),
        },
      }).queryKey,
      { ...project, invitations: [...project.invitations, data] },
    );

    toast.success("An invitation has been sent to the selected user");
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex items-start gap-2">
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Input
              className="flex-1"
              type="email"
              placeholder="Email address"
              aria-invalid={fieldState.invalid}
              {...field}
            />
          )}
        />

        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              name={field.name}
              disabled={field.disabled}
            >
              <SelectTrigger className="w-34 shrink-0">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {assignableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />

        <Button
          size="icon"
          className="shrink-0"
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <Spinner className="size-4" />
          ) : (
            <IconUserPlus className="size-4" />
          )}
        </Button>
      </div>
    </form>
  );
}
