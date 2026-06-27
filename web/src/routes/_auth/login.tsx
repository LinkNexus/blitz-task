import { zodResolver } from "@hookform/resolvers/zod";
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouteContext,
  useSearch,
} from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { type LoginData, login } from "@/api";
import { getCurrentUserOptions } from "@/api/@tanstack/react-query.gen";
import { CheckboxField } from "@/components/forms/fields/checkbox";
import { InputField } from "@/components/forms/fields/input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AuthRedirectSchema } from "./-schemas.ts";
import { Route as CreateAccountRoute } from "./create-account.tsx";
import { Route as RequestPasswordResetRoute } from "./request-reset-password.tsx";

export const LoginSchema = z.object({
  email: z.email("Please, enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

export const Route = createFileRoute("/_auth/login")({
  validateSearch: AuthRedirectSchema,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { queryClient } = useRouteContext({ from: "__root__" });
  const { redirect } = useSearch({ from: "/_auth/login" });

  const form = useForm({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
    mode: "onBlur",
  });

  const onSubmit = async (formData: LoginData["body"]) => {
    const { data, error } = await login({
      body: formData,
    });

    if (error) {
      if ("message" in error) {
        toast.error("An error happened during login", {
          description: error.message,
        });
      } else {
        error.errors.forEach((e) => {
          form.setError(e.path as keyof z.infer<typeof LoginSchema>, {
            message: e.message,
          });
        });
      }
      return;
    }

    queryClient.setQueryData(getCurrentUserOptions().queryKey, data);
    toast.success("Welcome back!", {
      description: `Logged in as ${data.name}`,
    });

    await navigate({ to: redirect || "/dashboard" });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-bold text-2xl">Welcome back 👋</h1>
          <p className="text-balance text-muted-foreground">
            Login to your Blitz-Task Account
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

        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center">
                <FieldLabel htmlFor="login-form-password">Password</FieldLabel>
                <Link
                  to={RequestPasswordResetRoute.to}
                  className="ml-auto text-xs underline-offset-2 hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input
                {...field}
                type="password"
                id="login-form-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="rememberMe"
          render={({ field, fieldState }) => (
            <CheckboxField
              field={field}
              fieldState={fieldState}
              labelProps={{ children: "Remember me" }}
            />
          )}
        />

        <Field>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Spinner /> Logging in...
              </>
            ) : (
              "Login"
            )}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Don&apos;t have an account?{" "}
          <Link to={CreateAccountRoute.to} search={(prev) => prev}>
            Sign up
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
