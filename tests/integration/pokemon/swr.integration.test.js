import request from "supertest";
import app from "../../../backend/app.js";
import pokeApi from "../../../backend/src/clients/pokeapi.client.js";
import {
  clearPokemonCache,
  setPokemonCache,
} from "../../../backend/src/cache/pokemon.cache.js";
import { env } from "../../../config/env.js";
import makePokemon from "../../factories/pokemon.factory.js";
import makePokemonCard from "../../factories/pokemon-card.factory.js";

vi.mock("../../../backend/src/clients/pokeapi.client.js", () => ({
  default: vi.fn(),
}));

const pokemonListCacheKey = env.pokemonListCacheKey;
const page1CacheKey = `${pokemonListCacheKey}:limit=50:offset=0`;
const pokemon = makePokemon();
const pokemonCard = makePokemonCard();
const stalePage = { count: 1302, results: [pokemonCard] };
const list = {
  count: 1302,
  results: [{ url: "https://pokeapi.co/api/v2/pokemon/1/" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  clearPokemonCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /pokemons - SWR integration", () => {
  it("should return stale paginated data immediately and refresh the same page through HTTP", async () => {
    setPokemonCache(
      page1CacheKey,
      stalePage,
      Date.now() - env.cacheFreshTtlMs - 1,
    );

    let resolveDetails;
    const detailsPromise = new Promise((resolve) => {
      resolveDetails = resolve;
    });

    pokeApi.mockImplementation((url) => {
      if (url === "pokemon?limit=50&offset=0") {
        return Promise.resolve(list);
      }
      return detailsPromise;
    });

    const response = await request(app).get("/pokemons");

    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(stalePage);
    expect(pokeApi).toHaveBeenCalledTimes(2);
    expect(pokeApi).toHaveBeenNthCalledWith(1, "pokemon?limit=50&offset=0");

    resolveDetails(pokemon);
  });

  it("should keep the stale HTTP response successful when background refresh fails", async () => {
    setPokemonCache(
      page1CacheKey,
      stalePage,
      Date.now() - env.cacheFreshTtlMs - 1,
    );

    const refreshError = new Error("PokeAPI unavailable");
    let rejectDetails;
    const detailsPromise = new Promise((_, reject) => {
      rejectDetails = reject;
    });

    pokeApi.mockImplementation((url) => {
      if (url === "pokemon?limit=50&offset=0") {
        return Promise.resolve(list);
      }
      return detailsPromise;
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = await request(app).get("/pokemons");

    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(stalePage);
    expect(pokeApi).toHaveBeenCalledTimes(2);

    rejectDetails(refreshError);

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "background cache refresh failed",
        refreshError,
      );
    });
  });
});
