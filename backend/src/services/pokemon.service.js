import pokeApi from "../clients/pokeapi.client.js";
import pokemonCache from "../cache/pokemon.cache.js";
import {
  mapPokemonDetails,
  mapPokemonCard,
} from "../mappers/pokemon/pokemon.mapper.js";
import ValidationError from "../errors/validation.error.js";
import NotFoundError from "../errors/not-found.error.js";
import {
  pokemonCardSchema,
  pokemonDetailsSchema,
  pokemonResultSchema,
  pokemonResponseSchema,
  pokeApiPokemonCardResponseSchema,
  pokemonSpeciesResponseSchema,
} from "../schemas/pokemon.schema.js";

const maximumPokemonId = 500;
let requestSequence = 0;
const pokemonFetchBatchSize = 20;
const pokemonListCacheKey = "pokemons:all";

export default class PokemonService {
  async getPokemons() {
    const timerLabel = `getPokemons:${++requestSequence}`;

    console.time(timerLabel);

    try {
      const cachedPokemons = pokemonCache.get(pokemonListCacheKey);

      if (cachedPokemons !== undefined) {
        console.log("cache HIT");

        return cachedPokemons;
      }

      console.log("cache MISS");

      const response = await pokeApi(`pokemon?limit=${maximumPokemonId}`);

      const { results } = this.#validate(pokemonResultSchema, response);

      const cards = [];

      for (
        let index = 0;
        index < results.length;
        index += pokemonFetchBatchSize
      ) {
        const batch = results.slice(index, index + pokemonFetchBatchSize);

        const batchCards = await Promise.all(
          batch.map(({ url }) => this.#getPokemonCard(url)),
        );

        cards.push(...batchCards);
      }

      pokemonCache.set(pokemonListCacheKey, cards);

      return cards;
    } finally {
      console.timeEnd(timerLabel);
    }
  }

  async getPokemonById(id) {
    this.#validatePokemonId(id);

    const pokemon = await pokeApi(`pokemon/${id}`);

    const validatedPokemon = this.#validate(pokemonResponseSchema, pokemon);

    const pokemonDescription = await this.#getPokemonDescription(
      validatedPokemon.species.url,
    );

    const mapped = mapPokemonDetails(validatedPokemon, pokemonDescription);

    return this.#validate(pokemonDetailsSchema, mapped);
  }

  async #getPokemonCard(url) {
    const pokemon = await pokeApi(url);

    const validatedPokemon = this.#validate(
      pokeApiPokemonCardResponseSchema,
      pokemon,
    );

    const mapped = mapPokemonCard(validatedPokemon);

    return this.#validate(pokemonCardSchema, mapped);
  }

  #validatePokemonId(id) {
    if (!Number.isInteger(id) || id <= 0 || id > maximumPokemonId) {
      throw new NotFoundError("Pokemon not found");
    }
  }

  #validate(schema, data) {
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];

      const path = issue.path.length > 0 ? issue.path.join(".") : "root";

      throw new ValidationError(`${issue.message}. Path: ${path}`, {
        cause: parsed.error,
      });
    }

    return parsed.data;
  }

  async #getPokemonDescription(speciesUrl) {
    const species = await pokeApi(speciesUrl);

    const validatedSpecies = this.#validate(
      pokemonSpeciesResponseSchema,
      species,
    );

    const description = validatedSpecies.flavor_text_entries.find(
      ({ language: { name } }) => name === "en",
    );

    if (!description) {
      throw new ValidationError(
        "External API did not return an English description",
      );
    }

    return description.flavor_text.replace(/\s+/g, " ").trim();
  }
}
