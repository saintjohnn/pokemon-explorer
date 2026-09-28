import pokeApi from "../clients/pokeapi.client.js";
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
import { singleFlight } from "../utils/single-flight.js";
import { env } from "../../../config/env.js";
import {
  getPokemonCache,
  setPokemonCache,
  deletePokemonCache,
} from "../cache/pokemon.cache.js";

const pokemonFetchBatchSize = 20;
const pokemonListCacheKey = env.pokemonListCacheKey;

export default class PokemonService {
  async getPokemons({ limit = 50, offset = 0 } = {}) {
    const cacheKey = `${pokemonListCacheKey}:limit=${limit}:offset=${offset}`;

    const cachedEntry = getPokemonCache(cacheKey);

    const cachedState = this.#getCacheState(cachedEntry, cacheKey);

    if (cachedState === "fresh") {
      console.log("cache HIT");

      return cachedEntry.value;
    }

    if (cachedState === "stale") {
      console.log("cache HIT and refresh in background");

      this.#refreshPokemonsInBackground(cacheKey, limit, offset);

      return cachedEntry.value;
    }

    console.log("cache MISS: expired or absent");

    return singleFlight(cacheKey, () =>
      this.#fetchAndCachePokemons(cacheKey, limit, offset),
    );
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

  #getCacheState(entry, cacheKey) {
    if (!entry) {
      return "absent";
    }

    const age = Date.now() - entry.createdAt;

    if (age < env.cacheFreshTtlMs) {
      return "fresh";
    }

    if (age < env.cacheStaleTtlMs) {
      return "stale";
    }

    deletePokemonCache(cacheKey);

    return "expired";
  }

  #refreshPokemonsInBackground(cacheKey, limit, offset) {
    singleFlight(cacheKey, () =>
      this.#fetchAndCachePokemons(cacheKey, limit, offset),
    ).catch((error) => {
      console.error("background cache refresh failed", error);
    });
  }

  async #fetchAndCachePokemons(cacheKey, limit, offset) {
    console.log("PERFORMING FULL OPERATION");

    const cachedEntry = getPokemonCache(cacheKey);

    if (this.#getCacheState(cachedEntry, cacheKey) === "fresh") {
      console.log("cache HIT after single-flight");

      return cachedEntry.value;
    }

    const response = await pokeApi(`pokemon?limit=${limit}&offset=${offset}`);

    const { count, results } = this.#validate(pokemonResultSchema, response);

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

    const page = { count, results: cards };

    setPokemonCache(cacheKey, page);

    return page;
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
