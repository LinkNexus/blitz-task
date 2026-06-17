import { zodResolver } from "@hookform/resolvers/zod";
import { IconUserPlus } from "@tabler/icons-react";
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { type CreateAccountData, createAccount } from "@/api";
import { getCurrentUserOptions } from "@/api/@tanstack/react-query.gen";
import { InputField } from "@/components/forms/fields/input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { PasswordSchema } from "@/lib/shared-models";
import { flashMessagesStore } from "@/lib/store";
import { Route as LoginRoute } from "@/routes/_auth/login";

export const CreateAccountSchema = PasswordSchema.extend({
  name: z
    .string()
    .min(2, "The name must have at least 2 characters")
    .max(255, "The name must have at most 255 characters")
    .regex(
      /^[\w -]+$/,
      "The name can only contain alphanumeric characters, spaces, dashes and underscores",
    ),
  email: z.email(),
});

export const Route = createFileRoute("/_auth/create-account")({
  component: CreateAccountPage,
});

function CreateAccountPage() {
  const navigate = useNavigate();
  const { queryClient } = useRouteContext({ from: "__root__" });

  const form = useForm({
    resolver: zodResolver(CreateAccountSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(formData: CreateAccountData["body"]) {
    const { data, error } = await createAccount({ body: formData });

    if (error) {
      if ("message" in error) {
        toast.error("An error happened during account creation", {
          description: error.message,
        });
      } else if (error.errors) {
        error.errors.forEach((e) => {
          form.setError(e.path as keyof z.infer<typeof CreateAccountSchema>, {
            message: e.message,
          });
        });
      }

      return;
    }

    queryClient.setQueryData(getCurrentUserOptions().queryKey, data);
    flashMessagesStore.actions.add([
      {
        type: "success",
        message: {
          title: "Account created",
          description: `Your account has been successfully created. Welcome to Blitz-Task, ${data.name}!`,
        },
      },
      {
        type: "info",
        message: {
          title: "Email Confirmation Required",
          description:
            "Please check your email and confirm your address to access all features.",
        },
      },
    ]);

    await navigate({ to: "/dashboard" });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-bold text-2xl">Join our community</h1>
          <p className="text-balance text-muted-foreground">
            Create your account and start managing your tasks
          </p>
        </div>

        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <InputField
              field={field}
              fieldState={fieldState}
              inputProps={{ autoComplete: "name", type: "text" }}
              labelProps={{ children: "Name" }}
            />
          )}
        />

        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <InputField
              field={field}
              fieldState={fieldState}
              inputProps={{ autoComplete: "email", type: "email" }}
              labelProps={{ children: "Email Address" }}
            />
          )}
        />

        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <InputField
              field={field}
              fieldState={fieldState}
              inputProps={{ autoComplete: "new-password", type: "password" }}
              labelProps={{ children: "Password" }}
            />
          )}
        />

        <Controller
          control={form.control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <InputField
              field={field}
              fieldState={fieldState}
              inputProps={{ type: "password" }}
              labelProps={{ children: "Confirm Password" }}
            />
          )}
        />

        <Field>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Spinner /> Creating account...
              </>
            ) : (
              <>
                <IconUserPlus /> Create Account
              </>
            )}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Already have an account? <Link to={LoginRoute.to}>Login</Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
