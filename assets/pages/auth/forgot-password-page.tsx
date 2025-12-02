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
import type { ApiError } from "@/lib/api-fetch";
import { type ForgotPasswordForm, forgotPasswordSchema } from "@/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail } from "lucide-react";
import { memo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Link } from "wouter";

export const ForgotPasswordPage = memo(() => {
	const form = useForm<ForgotPasswordForm>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: {
			email: "",
		},
	});

	const { pending, action: sendResetLink } = useApiFetch<
		null,
		{ error: string },
		ForgotPasswordForm
	>({
		url: "/api/reset-password",
		options: {
			onSuccess() {
				toast.success(
					"The reset link has been sent to the email address corresponding to the provided identifer",
				);
			},
			onError(err: ApiError<{ error: string }>) {
				toast.error(err.response.data.error, {
					closeButton: true,
				});
			},
		},
	});

	return (
		<AuthPageStructure
			title="Forgot your password?"
			description="Enter your email to reset your password"
		>
			<Form {...form}>
				<form
					className="space-y-4"
					onSubmit={form.handleSubmit(
						async (data) => await sendResetLink({ data }),
					)}
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
					<Button type="submit" className="w-full" disabled={pending}>
						{pending ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin"></Loader2>
								Sending...
							</>
						) : (
							<>
								<Mail className="h-4 w-4 mr-2" />
								Send Reset Link
							</>
						)}
					</Button>
				</form>
			</Form>

			<div className="space-y-3">
				<Separator />
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
		</AuthPageStructure>
	);
});
