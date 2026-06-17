import z from "zod";

export const PasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "The password must contain at least 8 characters")
      .max(64, "The password must contain at most 64 characters"),
    confirmPassword: z.string(),
  })
  .refine((val) => val.password === val.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const tokenSchemaObject = {
  userId: z.coerce.number(),
  token: z.string(),
};
