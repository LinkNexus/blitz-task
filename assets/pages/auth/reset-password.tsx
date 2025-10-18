import { AuthPageStructure } from "@/components/custom/auth/structure";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useApiFetch } from "@/hooks/use-api-fetch";
import type { ApiError } from "@/lib/api-fetch";
import { setFormErrors } from "@/lib/forms";
import type { FormErrors } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { navigate } from "wouter/use-browser-location";
import z from "zod";

const resetPasswordSchema = z
  .object({
    password: z.string(),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function ResetPassword() {
  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const { pending, callback: resetPassword } = useApiFetch<
    null,
    { error: string } | FormErrors
  >("/api/reset-password/reset", {
    onSuccess() {
      toast.success("Password has been reset successfully", {
        closeButton: true,
      });
      navigate("/login");
    },
    onError(err) {
      if (
        "violations" in err.data &&
        Array.isArray((err.data as FormErrors).violations)
      ) {
        setFormErrors(form, err.data as FormErrors);
      } else if ("error" in err.data) {
        toast.error(err.data.error, {
          closeButton: true,
        });
      }
    },
  });

  return (
    <AuthPageStructure
      title="Reset your password"
      description="Enter your new password below. Make sure it is strong and secure."
    >
      <Form {...form}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(
            async (data) => await resetPassword({ data }),
          )}
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resetting Password...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>
      </Form>
    </AuthPageStructure>
  );
}
