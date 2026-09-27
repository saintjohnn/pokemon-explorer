import PokemonService from "../../../backend/src/services/pokemon.service.js";
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
const service = new PokemonService();
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

describe("SWR cache behavior", () => {
  it("should return fresh cache without calling the API", async () => {
    //Arrange
    setPokemonCache(pokemonListCacheKey, [pokemonCard], Date.now());

    //Act
    const pokemonResponse = await service.getPokemons();

    //Assert
    expect(pokemonResponse).toStrictEqual([pokemonCard]);
    expect(pokeApi).not.toHaveBeenCalled();
  });

  it("should return stale data immediately and refresh in background", async () => {
    //Arrange
    setPokemonCache(
      pokemonListCacheKey,
      [pokemonCard],
      Date.now() - env.cacheFreshTtlMs - 1,
    );

    pokeApi.mockResolvedValueOnce(list).mockResolvedValueOnce(pokemon);

    //Act
    const pokemonResponse = await service.getPokemons();

    //Assert
    expect(pokemonResponse).toStrictEqual([pokemonCard]);

    await vi.waitFor(() => expect(pokeApi).toHaveBeenCalledTimes(2));
  });

  it("should fetch synchronously when the entry is expired", async () => {
    //Arrange
    setPokemonCache(
      pokemonListCacheKey,
      [pokemonCard],
      Date.now() - env.cacheStaleTtlMs - 1,
    );

    pokeApi.mockResolvedValueOnce(list).mockResolvedValueOnce(pokemon);

    //Act
    const pokemonResponse = await service.getPokemons();

    //Assert
    expect(pokemonResponse).toStrictEqual([pokemonCard]);
    expect(pokeApi).toHaveBeenCalledTimes(2);
  });

  it("should return stale data when background refresh fails", async () => {
    // Arrange
    setPokemonCache(
      pokemonListCacheKey,
      [pokemonCard],
      Date.now() - env.cacheFreshTtlMs - 1,
    );

    const refreshError = new Error("PokeAPI unavailable");

    pokeApi.mockResolvedValueOnce(list).mockRejectedValueOnce(refreshError);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const pokemonResponse = await service.getPokemons();

    // Assert
    expect(pokemonResponse).toStrictEqual([pokemonCard]);

    await vi.waitFor(() => {
      expect(pokeApi).toHaveBeenCalledTimes(2);
    });

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "background cache refresh failed",
        refreshError,
      );
    });
  });
});
