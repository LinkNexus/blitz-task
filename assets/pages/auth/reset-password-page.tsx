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
import { useApiFetch } from "@/hooks/use-api-fetch";
import { setFormErrors } from "@/lib/forms";
import { type ResetPasswordForm, resetPasswordSchema } from "@/schemas";
import type { FormErrors } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { memo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { navigate } from "wouter/use-browser-location";

export const ResetPasswordPage = memo(() => {
	const form = useForm<ResetPasswordForm>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: {
			password: "",
			confirmPassword: "",
		},
	});

	const { pending, action: resetPassword } = useApiFetch<
		null,
		{ error: string } | FormErrors,
		ResetPasswordForm
	>({
		url: "/api/reset-password/reset",
		options: {
			onSuccess() {
				toast.success("Password has been reset successfully", {
					closeButton: true,
				});
				navigate("/login");
			},
			onError(err) {
				if (
					"violations" in err.response.data &&
					Array.isArray((err.response.data as FormErrors).violations)
				) {
					setFormErrors(form, err.response.data as FormErrors);
				} else if ("error" in err.response.data) {
					toast.error(err.response.data.error, {
						closeButton: true,
					});
				}
			},
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
});
