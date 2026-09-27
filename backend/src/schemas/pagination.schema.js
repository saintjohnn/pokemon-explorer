import { z } from "zod";

const queryInteger = (fallback, minimum) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(minimum))
    .optional()
    .transform((value) => value ?? fallback);

export const paginationSchema = z.object({
  limit: queryInteger(50, 1),
  offset: queryInteger(0, 0),
});
