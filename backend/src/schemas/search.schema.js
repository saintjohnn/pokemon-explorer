import { z } from "zod"
import { queryInteger } from "./pagination.schema.js"

export const pokemonSearchQuerySchema = z.object({
	q: z.string().trim().min(1).max(100),
	limit: queryInteger(50, 1),
	offset: queryInteger(0, 0),
})
