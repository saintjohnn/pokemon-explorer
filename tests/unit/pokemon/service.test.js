import PokemonService from "../../../backend/src/services/pokemon.service.js";
import NotFoundError from "../../../backend/src/errors/not-found.error.js";
import ValidationError from "../../../backend/src/errors/validation.error.js";
import pokeApi from "../../../backend/src/clients/pokeapi.client.js";
import makePokemon from "../../factories/pokemon.factory.js";
import makePokemonCard from "../../factories/pokemon-card.factory.js";
import makePokemonSpecies from "../../factories/pokemon-species.factory.js";
import makePokemonDetails from "../../factories/pokemon-details.factory";

vi.mock("../../../backend/src/clients/pokeapi.client.js", () => ({
  default: vi.fn(),
}));

const listEndpoint = "pokemon?limit=500";
const pokemonUrl = "https://pokeapi.co/api/v2/pokemon/1/";

describe("PokemonService", () => {
  const pokemonService = new PokemonService();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getPokemons", () => {
    it("should return mapped pokemon cards", async () => {
      // Arrange
      const secondPokemonUrl = "https://pokeapi.co/api/v2/pokemon/2/";
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
          results: [{ url: pokemonUrl }, { url: secondPokemonUrl }],
        })
        .mockResolvedValueOnce(bulbasaur)
        .mockResolvedValueOnce(ivysaur);

      // Act
      const result = await pokemonService.getPokemons();

      // Assert
      expect(result).toStrictEqual([
        makePokemonCard(),
        makePokemonCard({
          id: 2,
          name: "ivysaur",
          image:
            "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
        }),
      ]);
      expect(pokeApi).toHaveBeenNthCalledWith(1, listEndpoint);
      expect(pokeApi).toHaveBeenCalledWith(pokemonUrl);
      expect(pokeApi).toHaveBeenCalledWith(secondPokemonUrl);
      expect(pokeApi).toHaveBeenCalledTimes(3);
    });

    it("should propagate an error from the list request", async () => {
      // Arrange
      const apiError = new Error("List request failed");
      pokeApi.mockRejectedValueOnce(apiError);

      // Act
      const promise = pokemonService.getPokemons();

      // Assert
      await expect(promise).rejects.toBe(apiError);
      expect(pokeApi).toHaveBeenCalledExactlyOnceWith(listEndpoint);
    });

    it("should reject an invalid list response and preserve the Zod error", async () => {
      // Arrange
      pokeApi.mockResolvedValueOnce({ results: "invalid" });

      // Act
      const error = await pokemonService.getPokemons().catch((error) => error);

      // Assert
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.cause.name).toBe("ZodError");
      expect(error.cause.issues).toBeInstanceOf(Array);
      expect(pokeApi).toHaveBeenCalledExactlyOnceWith(listEndpoint);
    });

    it("should propagate an error from an individual pokemon request", async () => {
      // Arrange
      const apiError = new Error("Pokemon request failed");
      pokeApi
        .mockResolvedValueOnce({ results: [{ url: pokemonUrl }] })
        .mockRejectedValueOnce(apiError);

      // Act
      const promise = pokemonService.getPokemons();

      // Assert
      await expect(promise).rejects.toBe(apiError);
      expect(pokeApi).toHaveBeenNthCalledWith(1, listEndpoint);
      expect(pokeApi).toHaveBeenNthCalledWith(2, pokemonUrl);
      expect(pokeApi).toHaveBeenCalledTimes(2);
    });

    it("should reject an invalid individual pokemon response", async () => {
      // Arrange
      pokeApi
        .mockResolvedValueOnce({ results: [{ url: pokemonUrl }] })
        .mockResolvedValueOnce({ id: "invalid" });

      // Act
      const promise = pokemonService.getPokemons();

      // Assert
      await expect(promise).rejects.toBeInstanceOf(ValidationError);
      expect(pokeApi).toHaveBeenCalledTimes(2);
    });

    it("should fetch pokemon cards in batches of at most 20 requests", async () => {
      // Arrange
      const results = Array.from({ length: 21 }, (_, index) => ({
        url: `https://pokeapi.co/api/v2/pokemon/${index + 1}/`,
      }));
      let activeRequests = 0;
      let maximumActiveRequests = 0;

      pokeApi.mockImplementation(async (pathOrUrl) => {
        if (pathOrUrl === listEndpoint) {
          return { results };
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

      // Act
      const result = await pokemonService.getPokemons();

      // Assert
      expect(result).toHaveLength(21);
      expect(maximumActiveRequests).toBe(20);
      expect(pokeApi).toHaveBeenCalledTimes(22);
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

    it.each([-1, 0, 1.5, Number.NaN, 501, "1"])(
      "should reject the invalid or out-of-range id %j",
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

    it.each([1, 499, 500])("should accept the in-range id %i", async (id) => {
      // Arrange
      const apiError = new Error("Stop after ID validation");
      pokeApi.mockRejectedValueOnce(apiError);

      // Act
      const promise = pokemonService.getPokemonById(id);

      // Assert
      await expect(promise).rejects.toBe(apiError);
      expect(pokeApi).toHaveBeenCalledExactlyOnceWith(`pokemon/${id}`);
    });

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
