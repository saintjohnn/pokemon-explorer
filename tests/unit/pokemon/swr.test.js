import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PokemonService from "../../../backend/src/services/pokemon.service.js";
import pokeApi from "../../../backend/src/clients/pokeapi.client.js";
import {
  clearPokemonCache,
  setPokemonCache,
} from "../../../backend/src/cache/pokemon.cache.js";
import { env } from "../../../config/env.js";
import makePokemon from "../../factories/pokemon.factory.js";

vi.mock("../../../backend/src/clients/pokeapi.client.js", () => ({
  default: vi.fn(),
}));

const key = env.pokemonListCacheKey;
const service = new PokemonService();
const card = {
  id: 1,
  name: "bulbasaur",
  types: ["grass", "poison"],
  image:
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
};

const list = { results: [{ url: "https://pokeapi.co/api/v2/pokemon/1/" }] };

beforeEach(() => {
  vi.clearAllMocks();
  clearPokemonCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SWR cache behavior", () => {
  it("returns fresh cache without calling the API", async () => {
    setPokemonCache(key, [card], Date.now());

    await expect(service.getPokemons()).resolves.toStrictEqual([card]);

    expect(pokeApi).not.toHaveBeenCalled();
  });

  it("returns stale data immediately and refreshes in background", async () => {
    setPokemonCache(key, [card], Date.now() - env.cacheFreshTtlMs - 1);

    pokeApi.mockResolvedValueOnce(list).mockResolvedValueOnce(makePokemon());

    await expect(service.getPokemons()).resolves.toStrictEqual([card]);

    await vi.waitFor(() => expect(pokeApi).toHaveBeenCalledTimes(2));
  });

  it("fetches synchronously when the entry is expired", async () => {
    setPokemonCache(key, [card], Date.now() - env.cacheStaleTtlMs - 1);

    pokeApi.mockResolvedValueOnce(list).mockResolvedValueOnce(makePokemon());

    const result = await service.getPokemons();

    expect(result).toStrictEqual([card]);

    expect(pokeApi).toHaveBeenCalledTimes(2);
  });
});
