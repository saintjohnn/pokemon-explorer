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
const pokemon = makePokemon();
const pokemonCard = makePokemonCard();
const list = {
  results: [{ url: "https://pokeapi.co/api/v2/pokemonResponse/1/" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  clearPokemonCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /pokemons - SWR integration", () => {
  it("should return stale data immediately and refreshes through HTTP flow", async () => {
    //Arrange
    setPokemonCache(
      pokemonListCacheKey,
      [pokemonCard],
      Date.now() - env.cacheFreshTtlMs - 1,
    );

    let resolveDetails;

    const detailsPromise = new Promise((resolve) => {
      resolveDetails = resolve;
    });

    pokeApi.mockImplementation((url) => {
      if (url.includes("pokemon?limit=500")) {
        return Promise.resolve(list);
      }

      return detailsPromise;
    });

    //Act
    const response = await request(app).get("/pokemons");

    //Assert
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual([pokemonCard]);
    expect(pokeApi).toHaveBeenCalledTimes(2);

    resolveDetails(pokemon);
  });

  it("should keep the stale HTTP response successful when background refresh fails", async () => {
    //Arrange
    setPokemonCache(
      pokemonListCacheKey,
      [pokemonCard],
      Date.now() - env.cacheFreshTtlMs - 1,
    );

    let rejectDetails;

    const detailsPromise = new Promise((_, reject) => {
      rejectDetails = reject;
    });

    const refreshError = new Error("PokeAPI unavailable");

    pokeApi.mockImplementation((url) => {
      if (url.includes("pokemon?limit=500")) {
        return Promise.resolve(list);
      }

      return detailsPromise;
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    //Act
    const response = await request(app).get("/pokemons");

    //Assert
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual([pokemonCard]);
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
