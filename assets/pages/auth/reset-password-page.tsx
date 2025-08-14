import {zodResolver} from "@hookform/resolvers/zod";
import z from "zod";
import {useForm} from "react-hook-form";
import type {FormErrors} from "@/types.ts";
import {toast} from "sonner";
import {useApiFetch} from "@/hooks/useFetch.ts";
import {navigate} from "wouter/use-browser-location";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button.tsx";
import {Loader2} from "lucide-react";
import {SocialLinks} from "@/pages/auth/social-links.tsx";
import {Divider} from "@/components/custom/divider.tsx";
import {Separator} from "@/components/ui/separator.tsx";
import {Link} from "wouter";

export function ResetPasswordPage() {
  const resetPasswordSchema = z.object({
    password: z.string(),
    confirmPassword: z.string(),
  }).refine(
    (data) => data.password === data.confirmPassword,
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }
  );

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const {
    pending: pending,
    callback: resetPassword
  } = useApiFetch<null, { error: string } | FormErrors>("/api/auth/reset-password/reset", {
    method: "POST",
    onSuccess: () => {
      toast.success("Password has been reset successfully", {
        closeButton: true,
      });
      navigate("/login");
    },
    onError: (err) => {
      if ("violations" in err.data && Array.isArray((err.data as FormErrors).violations)) {
        (err.data as FormErrors).violations.forEach(v => {
          form.setError(v.propertyPath as keyof z.infer<typeof resetPasswordSchema>, {
            type: "manual",
            message: v.title
          });
        });
        return;
      } else if ("error" in err.data) {
        toast.error(err.data.error, {
          closeButton: true,
        })
      }
    }
  })

  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your new password to reset it. Make sure it's strong and secure.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <SocialLinks/>
          <Divider>or</Divider>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async (data) => await resetPassword({data}))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="password"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter new password" {...field} />
                    </FormControl>
                    <FormMessage/>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm new password" {...field} />
                    </FormControl>
                    <FormMessage/>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                    Resetting Password...
                  </>
                ) : "Reset Password"
                }
              </Button>
            </form>
          </Form>

          <div className="space-y-3">
            <Separator/>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                <Link href="/login">
                  <Button variant="link" className="p-0 h-auto font-medium">
                    Back to Sign In
                  </Button>
                </Link>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
