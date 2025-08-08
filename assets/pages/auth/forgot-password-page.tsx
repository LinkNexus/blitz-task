import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {z} from "zod";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Form, FormControl, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {FormField} from "@/components/ui/form.tsx";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Loader2, Mail} from "lucide-react";
import {useApiFetch} from "@/hooks/useFetch.ts";
import {toast} from "sonner";
import type {ApiError} from "@/lib/fetch.ts";
import {Separator} from "@/components/ui/separator.tsx";
import {Link} from "wouter";
import {SocialLinks} from "@/pages/auth/social-links.tsx";
import {Divider} from "@/components/custom/divider.tsx";

export function ForgotPasswordPage() {
  const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email address").nonempty("Email is required"),
  });

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    }
  });

  const {pending, callback: sendResetLink} = useApiFetch("/api/auth/reset-password", {
    onSuccess() {
      toast.success("The reset link has been sent to the email address corresponding the provided identifier")
    },
    onError(err: ApiError<{ error: string }>) {
      toast.error(err.data.error, {
        closeButton: true,
      })
    }
  })

  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address to reset your password
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <SocialLinks/>
          <Divider>or</Divider>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (data) => await sendResetLink({data}))}
            >
              <FormField
                control={form.control}
                name="email"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input autoComplete="email" placeholder="test@example.com" {...field} />
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
                    Sending Reset Link...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2"/>
                    Send Reset Link
                  </>
                )}
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
