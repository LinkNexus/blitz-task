import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Checkbox} from "@/components/ui/checkbox.tsx";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Separator} from "@/components/ui/separator.tsx";
import {useApiFetch} from "@/hooks/use-fetch.ts";
import {zodResolver} from "@hookform/resolvers/zod";
import {LoaderIcon} from "lucide-react";
import {useForm} from "react-hook-form";
import {Link} from "wouter";
import {z} from "zod";
import {SocialLinks} from "@/pages/auth/social-links.tsx";
import {Divider} from "@/components/custom/divider.tsx";
import {toast} from "sonner";
import type {ApiError} from "@/lib/fetch.ts";
import {useAppStore} from "@/lib/store.ts";

export function LoginPage() {
  const setUser = useAppStore.getState().setUser;

  const {pending, callback: login} = useApiFetch("/api/auth/login", {
    onError(error: ApiError<{ message: string }>) {
      console.log(error.data);
      toast.error(error.data.message, {
        description: "Please check your credentials and try again.",
        closeButton: true,
      });
    },
    onSuccess: setUser
  });

  const loginSchema = z.object({
    email: z.string(),
    password: z.string(),
    _remember_me: z.boolean().optional()
  });

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      _remember_me: true
    }
  });

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome Back</CardTitle>
        <CardDescription>
          Sign in to your account
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <SocialLinks/>
        <Divider>or</Divider>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (data) => await login({data}))}
          >
            <FormField
              control={form.control}
              name="email"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input autoComplete="email" disabled={pending} placeholder="test@example.com" {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({field}) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    Password
                    <Link href="/forgot-password"
                          className="hover:text-primary hover:underline hover:underline-offset-2 text-xs">Forgot
                      password?</Link>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      disabled={pending}
                      placeholder="Enter your password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="_remember_me"
              render={({field}) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={pending}
                    />
                  </FormControl>
                  <FormLabel>Remember Me</FormLabel>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={pending}
            >
              {pending && <LoaderIcon className="animate-spin"/>}
              {pending ? "Logging in..." : "Login"}
            </Button>
          </form>
        </Form>

        <div className="space-y-3">
          <Separator/>
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
      </CardContent>
    </Card>
  );
}
