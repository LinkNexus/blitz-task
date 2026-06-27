import { zodResolver } from "@hookform/resolvers/zod";
import { IconLock } from "@tabler/icons-react";
import {
  createFileRoute,
  Link,
  Navigate,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { type ResetPasswordData, resetPassword } from "@/api";
import { InputField } from "@/components/forms/fields/input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { PasswordSchema, tokenSchemaObject } from "@/lib/shared-models";
import { flashMessagesStore } from "@/lib/store";
import { Route as LoginRoute } from "./login";

export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: z.object(tokenSchemaObject),
  errorComponent: () => {
    useEffect(() => {
      flashMessagesStore.actions.addSingle({
        type: "error",
        message: {
          title: "Invalid link",
          description:
            "The reset link used to access this page is invalid or malformed. Retry the reset password process",
        },
      });
    }, []);

    return <Navigate to="/login" />;
  },
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_auth/reset-password" });

  const form = useForm({
    resolver: zodResolver(PasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (
    formData: Pick<ResetPasswordData["body"], "password" | "confirmPassword">,
  ) => {
    const { error } = await resetPassword({ body: { ...formData, ...search } });

    if (error) {
      if ("message" in error) {
        toast.error("An error occurred", {
          description: error.message,
        });
      } else {
        error.errors.forEach((e) => {
          form.setError(e.path as keyof z.infer<typeof PasswordSchema>, {
            message: e.message,
          });
        });
      }

      return;
    }

    toast.success("Password reset successfully", {
      description: "You can now login with your new password",
    });

    await navigate({
      to: LoginRoute.to,
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-bold text-2xl">Create new password</h1>
          <p className="text-balance text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <InputField
              field={field}
              fieldState={fieldState}
              inputProps={{ autoComplete: "new-password", type: "password" }}
              labelProps={{ children: "New Password" }}
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
                <Spinner /> Resetting...
              </>
            ) : (
              <>
                <IconLock /> Reset Password
              </>
            )}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Remember your password? <Link to={LoginRoute.to}>Back to login</Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
