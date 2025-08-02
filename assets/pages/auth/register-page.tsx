import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {z} from "zod";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form.tsx";
import {Input} from "@/components/ui/input.tsx";
import {SocialLinks} from "@/pages/auth/social-links.tsx";
import {Divider} from "@/components/custom/divider.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Loader2, UserPlus} from "lucide-react";
import {useApiFetch} from "@/hooks/use-fetch.ts";
import {Separator} from "@/components/ui/separator.tsx";
import {Link} from "wouter";

export function RegisterPage() {
  const {pending, callback: register} = useApiFetch("/api/auth/register");

  const registrationSchema = z.object({
    email: z.string().email({error: (iss) => `The email ${iss.input} is not a valid email address.`}),
    name: z.string()
      .min(3, "The name must be at least 3 characters long")
      .max(255, "The name must be at most 255 characters long")
      .regex(/^[a-zA-Z0-9_ ]+$/, "Name must only contain alphanumeric characters, spaces and underscores"),
    password: z.string(),
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((value) => value, {
      message: "You must accept the terms and conditions"
    })
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match"
  });

  const form = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false
    }
  });

  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>
            Join our community and start managing your tasks today!
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <SocialLinks/>
          <Divider>or</Divider>
          <Form {...form}>
            <form className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage/>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input autoComplete="email" placeholder="john@doe.com" {...field} />
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
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
                name="confirmPassword"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Confirm your password"
                        {...field}
                      />
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
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2"/>
                    Create Account
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="space-y-3">
            <Separator/>
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
        </CardContent>
      </Card>
    </>
  )
}
