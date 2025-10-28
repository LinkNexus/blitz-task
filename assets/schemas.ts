import z from "zod";

export const loginSchema = z.object({
	email: z.string().email("This email is not a valid email address"),
	password: z.string(),
	remember_me: z.boolean().optional(),
});

export type LoginForm = z.infer<typeof loginSchema>;

export const registrationSchema = z
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

export type RegistrationForm = z.infer<typeof registrationSchema>;

export const forgotPasswordSchema = z.object({
	email: z.string().email("This email is not a valid email address"),
});

export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
	.object({
		password: z.string(),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export const projectSchema = z.object({
	icon: z.string().optional().nullable(),
	name: z
		.string()
		.min(1, "Project name is required")
		.max(255, "Project name must be less than 255 characters")
		.regex(
			/^[a-zA-Z0-9_ ]+$/,
			"The project name can only contain letters, numbers, spaces, and underscores",
		)
		.trim(),
	description: z.string(),
	image: z.file().optional(),
});

export type ProjectForm = z.infer<typeof projectSchema>;
