import { z } from "zod"

export const pokemonSearchQuerySchema = z.object({
	q: z.string().trim().min(1).max(100),
})
