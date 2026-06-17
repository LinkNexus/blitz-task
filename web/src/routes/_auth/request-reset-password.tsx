import { zodResolver } from "@hookform/resolvers/zod";
import { IconMail } from "@tabler/icons-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { requestPasswordReset } from "@/api/sdk.gen.ts";
import type { RequestPasswordResetData } from "@/api/types.gen.ts";
import { InputField } from "@/components/forms/fields/input";
import { Button } from "@/components/ui/button.tsx";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Route as LoginRoute } from "./login.tsx";

const ResetPasswordSchema = z.object({
  email: z.email(),
});

export const Route = createFileRoute("/_auth/request-reset-password")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();

  const form = useForm({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (formData: RequestPasswordResetData["body"]) => {
    const { error } = await requestPasswordReset({ body: formData });

    if (error) {
      error.errors.forEach((e) => {
        form.setError(
          e.path as keyof z.infer<RequestPasswordResetData["body"]>,
          {
            message: e.message,
          },
        );
      });
      return;
    }

    toast.success("Reset email sent!", {
      description: "Check your mailbox for further instructions",
    });

    await navigate({ to: LoginRoute.to });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-bold text-2xl">Reset your password</h1>
          <p className="text-balance text-muted-foreground">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

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

        <Field>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Spinner /> Sending...
              </>
            ) : (
              <>
                <IconMail /> Send Reset Link
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
