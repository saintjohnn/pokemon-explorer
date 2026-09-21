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

import { singleFlight } from "../utils/single-flight.js";

import { env } from "../../../config/env.js";

import {
  getPokemonCache,
  setPokemonCache,
  deletePokemonCache,
} from "../cache/pokemon.cache.js";

const maximumPokemonId = 500;
let requestSequence = 0;
const pokemonFetchBatchSize = 20;
const pokemonListCacheKey = env.pokemonListCacheKey;

export default class PokemonService {
  async getPokemons() {
    const timerLabel = `getPokemons:${++requestSequence}`;

    console.time(timerLabel);

    try {
      const cachedEntry = getPokemonCache(pokemonListCacheKey);

      const cachedState = this.#getCacheState(cachedEntry);

      if (cachedState === "fresh") {
        console.log("cache HIT");

        return cachedEntry.value;
      }

      if (cachedState === "stale") {
        console.log("cache HIT");

        this.#refreshPokemonsInBackground();

        return cachedEntry.value;
      }

      console.log("cache MISS: expired or absent");

      return singleFlight(pokemonListCacheKey, () =>
        this.#fetchAndCachePokemons(),
      );
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

  #getCacheState(entry) {
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

    deletePokemonCache(pokemonListCacheKey);

    return "expired";
  }

  #refreshPokemonsInBackground() {
    singleFlight(pokemonListCacheKey, () =>
      this.#fetchAndCachePokemons(),
    ).catch((error) => {
      console.error("background cache refresh failed", error);
    });
  }

  async #fetchAndCachePokemons() {
    console.log("PERFORMING FULL OPERATION");

    const cachedEntry = getPokemonCache(pokemonListCacheKey);

    if (this.#getCacheState(cachedEntry) === "fresh") {
      console.log("cache HIT after single-flight");

      return cachedEntry.value;
    }

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

    setPokemonCache(pokemonListCacheKey, cards);

    return cards;
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
