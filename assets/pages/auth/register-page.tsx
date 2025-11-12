import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { memo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Link, useSearchParams } from "wouter";
import type z from "zod";
import { AuthPageStructure } from "@/components/custom/auth/structure";
import { Button } from "@/components/ui/button";
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
import { useAppStore } from "@/hooks/use-store";
import { type RegistrationForm, registrationSchema } from "@/schemas";
import type { FormErrors, ProjectInvitation, User } from "@/types";

export const RegistrationPage = memo(() => {
	const setUser = useAppStore.use.setUser();
	const [params] = useSearchParams();
	const email = params.get("email");

	const form = useForm<RegistrationForm>({
		resolver: zodResolver(registrationSchema),
		defaultValues: {
			email: email || "",
			name: "",
			password: "",
			confirmPassword: "",
		},
		mode: "onBlur",
	});

	const { pending: isSendingMail, action: sendMail } = useApiFetch<boolean>({
		url: "/api/resend-verification-mail",
		options: {
			onSuccess(res) {
				if (res.data) {
					toast.info(
						"Your email is already verified, no need to resend a verification mail.",
					);
				} else {
					toast.success("Verification email sent successfully!");
				}
			},
		},
	});

	const { pending, action: register } = useApiFetch<
		User,
		FormErrors,
		RegistrationForm
	>({
		url: "/api/register",
		options: {
			onSuccess(res) {
				setUser(res.data);
				toast.success("Your account was successfully created!", {
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
			onError(err) {
				err.response.data.violations.forEach((v) => {
					form.setError(
						v.propertyPath as keyof z.infer<typeof registrationSchema>,
						{
							message: v.title,
						},
					);
				});
			},
		},
		deps: [setUser],
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
});
