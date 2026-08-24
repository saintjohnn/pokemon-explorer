import { z } from "zod";

export const paramsSchema = z
  .string()
  .regex(/^\d+$/, "ID must contain only digits")
  .transform(Number)
  .pipe(z.number().int());
