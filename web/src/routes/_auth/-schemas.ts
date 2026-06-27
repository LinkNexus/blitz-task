import z from "zod";

export const AuthRedirectSchema = z.object({
  redirect: z.string().optional(),
});
