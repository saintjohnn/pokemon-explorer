import PokemonService from "../../../backend/src/services/pokemon.service.js";
import NotFoundError from "../../../backend/src/errors/not-found.error.js";
import ValidationError from "../../../backend/src/errors/validation.error.js";
import pokeApi from "../../../backend/src/clients/pokeapi.client.js";
import makePokemon from "../../factories/pokemon.factory.js";
import makePokemonCard from "../../factories/pokemon-card.factory.js";
import makePokemonSpecies from "../../factories/pokemon-species.factory.js";
import makePokemonDetails from "../../factories/pokemon-details.factory";
import pokemonCache from "../../../backend/src/cache/pokemon.cache";

vi.mock("../../../backend/src/clients/pokeapi.client.js", () => ({
  default: vi.fn(),
}));

const defaultListEndpoint = "pokemon?limit=50&offset=0";
const pokemonUrl = "https://pokeapi.co/api/v2/pokemon/1/";

describe("PokemonService", () => {
  const pokemonService = new PokemonService();

  beforeEach(() => {
    vi.resetAllMocks();
    pokemonCache.flushAll();
  });

  describe("getPokemons", () => {
    it("should return the count and mapped pokemon cards for the requested page", async () => {
      const bulbasaur = makePokemon();
      const ivysaur = makePokemon({
        id: 2,
        name: "ivysaur",
        sprites: {
          front_default:
            "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
        },
      });

      pokeApi
        .mockResolvedValueOnce({
          count: 1302,
          results: [
            { url: pokemonUrl },
            { url: "https://pokeapi.co/api/v2/pokemon/2/" },
          ],
        })
        .mockResolvedValueOnce(bulbasaur)
        .mockResolvedValueOnce(ivysaur);

      const result = await pokemonService.getPokemons();

      expect(result).toStrictEqual({
        count: 1302,
        results: [
          makePokemonCard(),
          makePokemonCard({
            id: 2,
            name: "ivysaur",
            image:
              "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
          }),
        ],
      });
      expect(pokeApi).toHaveBeenNthCalledWith(1, defaultListEndpoint);
      expect(pokeApi).toHaveBeenCalledWith(pokemonUrl);
      expect(pokeApi).toHaveBeenCalledWith(
        "https://pokeapi.co/api/v2/pokemon/2/",
      );
      expect(pokeApi).toHaveBeenCalledTimes(3);
    });

    it("should request the supplied limit and offset", async () => {
      pokeApi
        .mockResolvedValueOnce({
          count: 1302,
          results: [{ url: pokemonUrl }],
        })
        .mockResolvedValueOnce(makePokemon());

      const result = await pokemonService.getPokemons({
        limit: 25,
        offset: 50,
      });

      expect(result).toStrictEqual({
        count: 1302,
        results: [makePokemonCard()],
      });
      expect(pokeApi).toHaveBeenNthCalledWith(1, "pokemon?limit=25&offset=50");
    });

    it("should allow a limit greater than 500", async () => {
      pokeApi
        .mockResolvedValueOnce({
          count: 1000,
          results: [{ url: pokemonUrl }],
        })
        .mockResolvedValueOnce(makePokemon());

      await expect(
        pokemonService.getPokemons({ limit: 501, offset: 0 }),
      ).resolves.toStrictEqual({ count: 1000, results: [makePokemonCard()] });

      expect(pokeApi).toHaveBeenNthCalledWith(1, "pokemon?limit=501&offset=0");
    });

    it("should propagate an error from the list request", async () => {
      const apiError = new Error("List request failed");
      pokeApi.mockRejectedValueOnce(apiError);

      const promise = pokemonService.getPokemons();

      await expect(promise).rejects.toBe(apiError);
      expect(pokeApi).toHaveBeenCalledExactlyOnceWith(defaultListEndpoint);
    });

    it("should reject an invalid list response and preserve the Zod error", async () => {
      pokeApi.mockResolvedValueOnce({ results: "invalid" });

      const error = await pokemonService.getPokemons().catch((error) => error);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.cause.name).toBe("ZodError");
      expect(error.cause.issues).toBeInstanceOf(Array);
      expect(pokeApi).toHaveBeenCalledExactlyOnceWith(defaultListEndpoint);
    });

    it("should reject a list response with an invalid count", async () => {
      pokeApi.mockResolvedValueOnce({ count: 0, results: [] });

      await expect(pokemonService.getPokemons()).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(pokeApi).toHaveBeenCalledExactlyOnceWith(defaultListEndpoint);
    });

    it("should propagate an error from an individual pokemon request", async () => {
      const apiError = new Error("Pokemon request failed");
      pokeApi
        .mockResolvedValueOnce({ count: 1, results: [{ url: pokemonUrl }] })
        .mockRejectedValueOnce(apiError);

      const promise = pokemonService.getPokemons();

      await expect(promise).rejects.toBe(apiError);
      expect(pokeApi).toHaveBeenNthCalledWith(1, defaultListEndpoint);
      expect(pokeApi).toHaveBeenNthCalledWith(2, pokemonUrl);
      expect(pokeApi).toHaveBeenCalledTimes(2);
    });

    it("should reject an invalid individual pokemon response", async () => {
      pokeApi
        .mockResolvedValueOnce({ count: 1, results: [{ url: pokemonUrl }] })
        .mockResolvedValueOnce({ id: "invalid" });

      await expect(pokemonService.getPokemons()).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(pokeApi).toHaveBeenCalledTimes(2);
    });

    it("should fetch pokemon cards in batches of at most 20 requests", async () => {
      const results = Array.from({ length: 21 }, (_, index) => ({
        url: `https://pokeapi.co/api/v2/pokemon/${index + 1}/`,
      }));
      let activeRequests = 0;
      let maximumActiveRequests = 0;

      pokeApi.mockImplementation(async (pathOrUrl) => {
        if (pathOrUrl === "pokemon?limit=21&offset=0") {
          return { count: 21, results };
        }

        const id = Number(new URL(pathOrUrl).pathname.split("/").at(-2));
        activeRequests += 1;
        maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
        await new Promise((resolve) => setTimeout(resolve, 0));
        activeRequests -= 1;

        return makePokemon({
          id,
          name: `pokemon-${id}`,
          sprites: {
            front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
          },
        });
      });

      const result = await pokemonService.getPokemons({ limit: 21 });

      expect(result.results).toHaveLength(21);
      expect(result.count).toBe(21);
      expect(maximumActiveRequests).toBe(20);
      expect(pokeApi).toHaveBeenCalledTimes(22);
    });

    it("should use the service defaults when called without arguments", async () => {
      pokeApi.mockResolvedValueOnce({ count: 1, results: [] });

      await pokemonService.getPokemons();

      expect(pokeApi).toHaveBeenCalledExactlyOnceWith(defaultListEndpoint);
    });

    it("should use a default offset when only a limit is supplied", async () => {
      pokeApi.mockResolvedValueOnce({ count: 1, results: [] });

      await pokemonService.getPokemons({ limit: 25 });

      expect(pokeApi).toHaveBeenCalledExactlyOnceWith(
        "pokemon?limit=25&offset=0",
      );
    });
  });

  describe("getPokemonById", () => {
    it("should return mapped pokemon details", async () => {
      // Arrange
      const pokemon = makePokemon();
      const species = makePokemonSpecies();
      pokeApi.mockResolvedValueOnce(pokemon).mockResolvedValueOnce(species);

      // Act
      const result = await pokemonService.getPokemonById(1);

      // Assert
      expect(result).toStrictEqual({
        ...makePokemonDetails(),
      });
      expect(pokeApi).toHaveBeenNthCalledWith(1, "pokemon/1");
      expect(pokeApi).toHaveBeenNthCalledWith(2, pokemon.species.url);
      expect(pokeApi).toHaveBeenCalledTimes(2);
    });

    it.each([-1, 0, 1.5, Number.NaN, '"1"'])(
      "should reject %s as an invalid Pokemon id",
      async (id) => {
        // Act
        const promise = pokemonService.getPokemonById(id);

        // Assert
        await expect(promise).rejects.toBeInstanceOf(NotFoundError);
        expect(pokeApi).not.toHaveBeenCalled();
      },
    );

    it("should select and normalize the English description", async () => {
      // Arrange
      const pokemon = makePokemon();

      const species = {
        flavor_text_entries: [
          {
            flavor_text: "Descrição em português",
            language: { name: "pt" },
          },
          {
            flavor_text:
              "   A strange\nseed\twas\fplanted on its back at birth.\fThe plant sprouts and grows with this POKéMON.  ",
            language: { name: "en" },
          },
        ],
      };

      pokeApi.mockResolvedValueOnce(pokemon).mockResolvedValueOnce(species);

      // Act
      const result = await pokemonService.getPokemonById(1);

      // Assert
      expect(result.description).toBe(
        "A strange seed was planted on its back at birth. The plant sprouts and grows with this POKéMON.",
      );
    });

    it.each([1, 500, 501, 1000])(
      "should accept positive integer id %i",
      async (id) => {
        // Arrange
        const apiError = new Error("Stop after ID validation");
        pokeApi.mockRejectedValueOnce(apiError);

        // Act
        const promise = pokemonService.getPokemonById(id);

        // Assert
        await expect(promise).rejects.toBe(apiError);
        expect(pokeApi).toHaveBeenCalledExactlyOnceWith(`pokemon/${id}`);
      },
    );

    it("should propagate an error from the pokemon request", async () => {
      // Arrange
      const apiError = new Error("Pokemon request failed");
      pokeApi.mockRejectedValueOnce(apiError);

      // Act
      const promise = pokemonService.getPokemonById(1);

      // Assert
      await expect(promise).rejects.toBe(apiError);
      expect(pokeApi).toHaveBeenCalledExactlyOnceWith("pokemon/1");
    });

    it("should reject an invalid pokemon response with its validation path", async () => {
      // Arrange
      pokeApi.mockResolvedValueOnce({ id: "invalid" });

      // Act
      const promise = pokemonService.getPokemonById(1);

      // Assert
      await expect(promise).rejects.toMatchObject({
        name: "ValidationError",
        message: expect.stringContaining("Path: id"),
        cause: {
          name: "ZodError",
        },
      });

      expect(pokeApi).toHaveBeenCalledExactlyOnceWith("pokemon/1");
    });

    it("should use root when the validation issue has no path", async () => {
      // Arrange
      pokeApi.mockResolvedValueOnce(null);

      // Act
      const promise = pokemonService.getPokemonById(1);

      // Assert
      await expect(promise).rejects.toMatchObject({
        name: "ValidationError",
        message: expect.stringContaining("Path: root"),
        cause: {
          name: "ZodError",
        },
      });

      expect(pokeApi).toHaveBeenCalledExactlyOnceWith("pokemon/1");
    });

    it("should propagate an error from the species request", async () => {
      // Arrange
      const pokemon = makePokemon();
      const apiError = new Error("Species request failed");
      pokeApi.mockResolvedValueOnce(pokemon).mockRejectedValueOnce(apiError);

      // Act
      const promise = pokemonService.getPokemonById(1);

      // Assert
      await expect(promise).rejects.toBe(apiError);
      expect(pokeApi).toHaveBeenNthCalledWith(1, "pokemon/1");
      expect(pokeApi).toHaveBeenNthCalledWith(2, pokemon.species.url);
    });

    it("should reject an invalid species response", async () => {
      // Arrange
      const pokemon = makePokemon();
      pokeApi
        .mockResolvedValueOnce(pokemon)
        .mockResolvedValueOnce({ flavor_text_entries: "invalid" });

      // Act
      const promise = pokemonService.getPokemonById(1);

      // Assert
      await expect(promise).rejects.toBeInstanceOf(ValidationError);
      expect(pokeApi).toHaveBeenCalledTimes(2);
    });

    it("should reject a species response without an english description", async () => {
      // Arrange
      const pokemon = makePokemon();
      const species = makePokemonSpecies({ name: "pt" });
      pokeApi.mockResolvedValueOnce(pokemon).mockResolvedValueOnce(species);

      // Act
      const promise = pokemonService.getPokemonById(1);

      // Assert
      await expect(promise).rejects.toMatchObject({
        name: "ValidationError",
        message: "External API did not return an English description",
      });
    });
  });
});
