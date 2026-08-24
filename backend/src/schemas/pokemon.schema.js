import { z } from "zod";
import { isAllowedPokeApiUrl } from "../utils/pokeapi-url.js";

const positiveInt = z.number().int().positive();
const nonEmptyString = z.string().trim().min(1);
const httpUrlSchema = z.httpUrl();

const pokeApiUrlSchema = httpUrlSchema.refine(isAllowedPokeApiUrl, {
  message: "Invalid PokeAPI URL",
});

const typeSchema = z.object({
  type: z.object({
    name: nonEmptyString,
  }),
});

const abilitySchema = z.object({
  ability: z.object({
    name: nonEmptyString,
  }),
});

const statSchema = z.object({
  base_stat: positiveInt,
  stat: z.object({
    name: nonEmptyString,
  }),
});

const spriteSchema = z.object({
  front_default: httpUrlSchema.nullable(),
});

export const pokemonCardSchema = z.object({
  id: positiveInt,
  name: nonEmptyString,
  types: z.array(nonEmptyString).min(1),
  image: httpUrlSchema.nullable(),
});

export const pokemonDetailsSchema = pokemonCardSchema.extend({
  description: nonEmptyString,
  height: positiveInt,
  weight: positiveInt,
  abilities: z.array(nonEmptyString).min(1),
  stats: z
    .record(z.string(), positiveInt)
    .refine((stats) => Object.keys(stats).length > 0, {
      message: "Stats must contain at least one entry",
    }),
});

export const pokemonResultSchema = z.object({
  results: z
    .array(
      z.object({
        url: pokeApiUrlSchema,
      }),
    )
    .max(500),
});

export const pokemonResponseSchema = z.object({
  id: positiveInt,
  name: nonEmptyString,
  species: z.object({
    url: pokeApiUrlSchema,
  }),
  types: z.array(typeSchema).min(1),
  sprites: spriteSchema,
  height: positiveInt,
  weight: positiveInt,
  abilities: z.array(abilitySchema).min(1),
  stats: z.array(statSchema).min(1),
});

export const pokemonSpeciesResponseSchema = z.object({
  flavor_text_entries: z.array(
    z.object({
      flavor_text: nonEmptyString,
      language: z.object({
        name: nonEmptyString,
      }),
    }),
  ),
});

export const pokeApiPokemonCardResponseSchema = z.object({
  id: positiveInt,
  name: nonEmptyString,
  types: z.array(typeSchema).min(1),
  sprites: spriteSchema,
});
