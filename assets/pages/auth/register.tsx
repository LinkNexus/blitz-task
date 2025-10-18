import { AuthPageStructure } from "@/components/custom/auth/structure";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useApiFetch } from "@/hooks/use-api-fetch";
import { useAppStore } from "@/hooks/use-app-store";
import type { ApiError } from "@/lib/api-fetch";
import type { FormErrors, User } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Link } from "wouter";
import z from "zod";

const registrationSchema = z
  .object({
    name: z
      .string()
      .min(3, "The name must be at least 3 characters long")
      .max(255, "The name must be at most 255 characters long")
      .regex(
        /^[a-zA-Z0-9_ ]+$/,
        "The name can only contain letters, numbers, and underscores",
      ),
    email: z.string().email("This email is not a valid email address"),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
  });

export function Register() {
  const setUser = useAppStore((state) => state.setUser);

  const form = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onBlur",
  });

  const { pending: isSendingMail, callback: sendMail } = useApiFetch(
    "/api/resend-verification-mail",
    {
      onSuccess(isVerified: boolean) {
        if (isVerified) {
          toast.info(
            "Your email is already verified, no need to resend a verification mail.",
          );
        } else {
          toast.success("Verification email sent successfully!");
        }
      },
    },
  );

  const { pending, callback: register } = useApiFetch("/api/register", {
    onSuccess(user: User) {
      setUser(user);
      toast.success("Your accunt was successfully created!", {
        closeButton: true,
      });
      toast.info(
        "A validation email may be or has been sent to your given email address.",
        {
          action: {
            label: isSendingMail ? "Sending..." : "Resend",
            async onClick() {
              await sendMail();
            },
          },
        },
      );
    },
    onError(err: ApiError<FormErrors>) {
      err.data.violations.forEach((v) => {
        form.setError(
          v.propertyPath as keyof z.infer<typeof registrationSchema>,
          {
            message: v.title,
          },
        );
      });
    },
  });

  return (
    <AuthPageStructure
      title={"Get Started"}
      description="Join our community and start managing your tasks today!"
    >
      <Form {...form}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (data) => await register({ data }))}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
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

          <div className="text-xs">
            By creating an account, you accept the {""}
            <Link
              className="hover:underline hover:underline-offset-2 hover:text-primary"
              to="terms-and-conditions"
            >
              terms and conditions
            </Link>
            {""} of our service
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Account
              </>
            )}
          </Button>
        </form>
      </Form>

      <div className="space-y-3">
        <Separator />
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login">
              <Button variant="link" className="p-0 h-auto font-medium">
                Sign in
              </Button>
            </Link>
          </p>
        </div>
      </div>
    </AuthPageStructure>
  );
}
