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
const page = { count: 1302, results: [pokemonCard] };
const list = {
  count: 1302,
  results: [{ url: "https://pokeapi.co/api/v2/pokemon/1/" }],
};
const page1CacheKey = `${pokemonListCacheKey}:limit=50:offset=0`;
const page2CacheKey = `${pokemonListCacheKey}:limit=25:offset=50`;

beforeEach(() => {
  vi.clearAllMocks();
  clearPokemonCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SWR cache behavior", () => {
  it("should return fresh cache for the requested page without calling the API", async () => {
    //Arrange
    setPokemonCache(page1CacheKey, page, Date.now());

    //Act
    const pokemonResponse = await service.getPokemons();

    //Assert
    expect(pokemonResponse).toStrictEqual(page);
    expect(pokeApi).not.toHaveBeenCalled();
  });

  it("should use a distinct cache entry for each pagination page", async () => {
    //Arrange
    const page2 = { count: 1302, results: [makePokemonCard({ id: 2 })] };

    setPokemonCache(page1CacheKey, page, Date.now());
    setPokemonCache(page2CacheKey, page2, Date.now());

    //Act + Assert
    await expect(service.getPokemons()).resolves.toStrictEqual(page);
    await expect(
      service.getPokemons({ limit: 25, offset: 50 }),
    ).resolves.toStrictEqual(page2);

    expect(pokeApi).not.toHaveBeenCalled();
  });

  it("should return stale data immediately and refresh the requested page in background", async () => {
    //Arrange
    setPokemonCache(page1CacheKey, page, Date.now() - env.cacheFreshTtlMs - 1);

    pokeApi.mockResolvedValueOnce(list).mockResolvedValueOnce(pokemon);

    //Act
    const pokemonResponse = await service.getPokemons();

    //Assert
    expect(pokemonResponse).toStrictEqual(page);

    await vi.waitFor(() => expect(pokeApi).toHaveBeenCalledTimes(2));
    expect(pokeApi).toHaveBeenNthCalledWith(1, "pokemon?limit=50&offset=0");
  });

  it("should fetch synchronously when the requested page is expired", async () => {
    //Arrange
    setPokemonCache(page1CacheKey, page, Date.now() - env.cacheStaleTtlMs - 1);

    pokeApi.mockResolvedValueOnce(list).mockResolvedValueOnce(pokemon);

    //Act
    const pokemonResponse = await service.getPokemons();

    //Assert
    expect(pokemonResponse).toStrictEqual(page);
    expect(pokeApi).toHaveBeenCalledTimes(2);
  });

  it("should return stale data when background refresh fails", async () => {
    // Arrange
    setPokemonCache(page1CacheKey, page, Date.now() - env.cacheFreshTtlMs - 1);

    const refreshError = new Error("PokeAPI unavailable");

    pokeApi.mockResolvedValueOnce(list).mockRejectedValueOnce(refreshError);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const pokemonResponse = await service.getPokemons();

    // Assert
    expect(pokemonResponse).toStrictEqual(page);

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "background cache refresh failed",
        refreshError,
      );
    });
  });

  it("should cache the freshly fetched paginated response under its page key", async () => {
    //Arrange
    pokeApi.mockResolvedValueOnce(list).mockResolvedValueOnce(pokemon);

    //Act
    await service.getPokemons({ limit: 25, offset: 50 });

    //Assert
    expect(pokeApi).toHaveBeenNthCalledWith(1, "pokemon?limit=25&offset=50");
    expect(await service.getPokemons({ limit: 25, offset: 50 })).toStrictEqual(
      page,
    );
    expect(pokeApi).toHaveBeenCalledTimes(2);
  });
});
