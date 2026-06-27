import z from "zod";

export const MAX_PROJECT_IMAGE_SIZE = 400 * 1024;

export const ProjectSchema = z
  .object({
    name: z
      .string()
      .min(1, "Project name is required")
      .max(255, "Project name must be at most 255 characters long"),
    description: z
      .string()
      .max(1000, "Description must be at most 1000 characters long"),
    startDate: z.iso.datetime().nullable(),
    dueDate: z.iso.datetime().nullable(),
    tags: z.array(z.string().max(50)).max(10, "Maximum 10 tags allowed"),
    image: z
      .file()
      .max(
        MAX_PROJECT_IMAGE_SIZE,
        `The image size must be less than ${MAX_PROJECT_IMAGE_SIZE}`,
      )
      .mime(["image/png", "image/jpeg", "image/svg+xml", "image/webp"])
      .nullable(),
  })
  .refine(
    (schema) => {
      if (schema.startDate && schema.dueDate) {
        if (new Date(schema.startDate) > new Date(schema.dueDate)) {
          return false;
        }
      }
      return true;
    },
    {
      error: "Start date cannot be after due date",
      path: ["startDate"],
    },
  );
