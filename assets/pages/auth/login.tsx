import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/hooks/use-app-store";
import { toast } from "sonner";
import type { ApiError } from "@/lib/api-fetch";
import { useApiFetch } from "@/hooks/use-api-fetch";
import { AuthPageStructure } from "@/components/custom/auth/structure";
import { Separator } from "@/components/ui/separator";

export function Login() {
  const setUser = useAppStore((state) => state.setUser);
  const loginSchema = z.object({
    email: z.string().email("This email is not a valid email address"),
    password: z.string(),
    remember_me: z.boolean().optional(),
  });

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember_me: true,
    },
    mode: "onBlur",
  });

  const { pending, callback: login } = useApiFetch("/api/login", {
    onSuccess: setUser,
    onError(err: ApiError<{ message: string }>) {
      toast.error(err.data.message, {
        description: "Please check your credentials and try again",
        closeButton: true,
      });
    },
  });

  return (
    <AuthPageStructure
      title={"Welcome Back"}
      description="Sign in your account"
    >
      <Form {...form}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (data) => await login({ data }))}
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
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
                <FormLabel className="flex items-center justify-between">
                  Password
                  <Link
                    href="/forgot-password"
                    className="hover:text-primary hover:underline hover:underline-offset-2 text-xs"
                  >
                    Forgot password?
                  </Link>
                </FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="remember_me"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel>Remember Me</FormLabel>
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={pending}>
            Login
          </Button>
        </form>
      </Form>

      <div className="space-y-3">
        <Separator />
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register">
              <Button variant="link" className="p-0 h-auto font-medium">
                Sign up
              </Button>
            </Link>
          </p>
        </div>
      </div>
    </AuthPageStructure>
  );
}
