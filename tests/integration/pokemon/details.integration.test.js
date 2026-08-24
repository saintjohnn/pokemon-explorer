import request from "supertest";
import app from "../../../backend/app.js";
import pokeApi from "../../../backend/src/clients/pokeapi.client.js";
import PokeApiError from "../../../backend/src/errors/poke-api.error.js";
import makePokemonSpecies from "../../factories/pokemon-species.factory.js";
import makePokemon from "../../factories/pokemon.factory.js";
import makePokemonDetails from "../../factories/pokemon-details.factory.js";

vi.mock("../../../backend/src/clients/pokeapi.client.js", () => ({
  default: vi.fn(),
}));

describe("GET /pokemons/:id ", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return mapped details and normalize the English description", async () => {
    // Arrange
    const pokemon = makePokemon();
    const pokemonSpecies = makePokemonSpecies();

    pokeApi
      .mockResolvedValueOnce(pokemon)
      .mockResolvedValueOnce(pokemonSpecies);

    // Act
    const response = await request(app).get("/pokemons/1");

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(makePokemonDetails());
    expect(pokeApi).toHaveBeenNthCalledWith(1, "pokemon/1");
    expect(pokeApi).toHaveBeenNthCalledWith(2, pokemon.species.url);
  });

  it("should accept the maximum supported pokemon id", async () => {
    // Arrange
    const pokemon = makePokemon({
      id: 500,
      name: "emboar",
      species: {
        url: "https://pokeapi.co/api/v2/pokemon-species/500/",
      },
      types: [{ type: { name: "fire" } }, { type: { name: "fighting" } }],
      sprites: {
        front_default:
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/500.png",
      },
      height: 16,
      weight: 1500,
      abilities: [
        { ability: { name: "blaze" } },
        { ability: { name: "reckless" } },
      ],
      stats: [
        { base_stat: 110, stat: { name: "hp" } },
        { base_stat: 123, stat: { name: "attack" } },
        { base_stat: 65, stat: { name: "defense" } },
        { base_stat: 100, stat: { name: "special-attack" } },
        { base_stat: 65, stat: { name: "special-defense" } },
        { base_stat: 65, stat: { name: "speed" } },
      ],
    });

    const species = makePokemonSpecies({
      flavorText:
        "It has mastered fast and powerful fighting moves. It grows a beard of fire.",
    });

    pokeApi.mockResolvedValueOnce(pokemon).mockResolvedValueOnce(species);

    // Act
    const response = await request(app).get("/pokemons/500");

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(
      makePokemonDetails({
        id: 500,
        name: "emboar",
        types: ["fire", "fighting"],
        image:
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/500.png",
        description:
          "It has mastered fast and powerful fighting moves. It grows a beard of fire.",
        height: 16,
        weight: 1500,
        abilities: ["blaze", "reckless"],
        stats: {
          hp: 110,
          attack: 123,
          defense: 65,
          "special-attack": 100,
          "special-defense": 65,
          speed: 65,
        },
      }),
    );
  });

  it.each(["xyz", "1.2", "-1"])(
    "should return 400 for malformed pokemon id %s without calling PokeAPI",
    async (id) => {
      // Act
      const response = await request(app).get(`/pokemons/${id}`);

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body).toStrictEqual({
        message: "Invalid pokemon id",
      });
      expect(pokeApi).not.toHaveBeenCalled();
    },
  );

  it.each([0, 501])(
    "should return 404 for unsupported pokemon id %s without calling PokeAPI",
    async (id) => {
      // Act
      const response = await request(app).get(`/pokemons/${id}`);

      // Assert
      expect(response.statusCode).toBe(404);
      expect(response.body).toStrictEqual({
        message: "Pokemon not found",
      });
      expect(pokeApi).not.toHaveBeenCalled();
    },
  );

  it("should return 502 when the pokemon request returns a PokeApiError", async () => {
    // Arrange
    pokeApi.mockRejectedValueOnce(
      new PokeApiError("PokeAPI responded with status 404"),
    );

    // Act
    const response = await request(app).get("/pokemons/1");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: "PokeAPI responded with status 404",
    });
  });

  it("should return 502 when the species request returns a PokeApiError", async () => {
    // Arrange
    const pokemon = makePokemon();
    pokeApi
      .mockResolvedValueOnce(pokemon)
      .mockRejectedValueOnce(
        new PokeApiError("PokeAPI responded with status 503"),
      );

    // Act
    const response = await request(app).get("/pokemons/1");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: "PokeAPI responded with status 503",
    });
  });

  it("should return 502 when the pokemon response contains a disallowed species URL", async () => {
    // Arrange
    pokeApi.mockResolvedValueOnce(
      makePokemon({
        species: {
          url: "https://example.com/api/v2/pokemon-species/1/",
        },
      }),
    );

    // Act
    const response = await request(app).get("/pokemons/1");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: expect.stringContaining("species.url"),
    });
    expect(pokeApi).toHaveBeenCalledExactlyOnceWith("pokemon/1");
  });

  it("should return 502 when the external API returns no English description", async () => {
    // Arrange
    const pokemon = makePokemon();
    const pokemonSpecies = makePokemonSpecies({ name: "pt" });

    pokeApi
      .mockResolvedValueOnce(pokemon)
      .mockResolvedValueOnce(pokemonSpecies);

    // Act
    const response = await request(app).get("/pokemons/1");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: "External API did not return an English description",
    });
  });

  it("should return 502 when the species response is invalid", async () => {
    // Arrange
    const pokemon = makePokemon();
    pokeApi.mockResolvedValueOnce(pokemon).mockResolvedValueOnce({
      flavor_text_entries: "invalid",
    });

    // Act
    const response = await request(app).get("/pokemons/1");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: expect.stringContaining("flavor_text_entries"),
    });
  });

  it("should return 502 when the pokemon response has no species", async () => {
    // Arrange
    pokeApi.mockResolvedValueOnce(makePokemon({ species: undefined }));

    // Act
    const response = await request(app).get("/pokemons/1");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: expect.stringContaining("species"),
    });
    expect(pokeApi).toHaveBeenCalledExactlyOnceWith("pokemon/1");
  });

  it("should return 502 when the pokemon response is invalid", async () => {
    // Arrange
    pokeApi.mockResolvedValueOnce(
      makePokemon({
        id: "invalid-id",
        abilities: [],
        stats: [],
      }),
    );

    // Act
    const response = await request(app).get("/pokemons/1");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: expect.stringContaining("id"),
    });
  });

  it("should hide and log an unexpected failure from the pokemon request", async () => {
    // Arrange
    const error = new TypeError("fetch failed");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    pokeApi.mockRejectedValueOnce(error);

    // Act
    const response = await request(app).get("/pokemons/1");

    // Assert
    expect(response.statusCode).toBe(500);
    expect(response.body).toStrictEqual({
      message: "internal server error",
    });
    expect(response.body.message).not.toContain(error.message);
    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("should hide and log an unexpected failure from the species request", async () => {
    // Arrange
    const pokemon = makePokemon();
    const error = new TypeError("fetch failed");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    pokeApi.mockResolvedValueOnce(pokemon).mockRejectedValueOnce(error);

    // Act
    const response = await request(app).get("/pokemons/1");

    // Assert
    expect(response.statusCode).toBe(500);
    expect(response.body).toStrictEqual({
      message: "internal server error",
    });
    expect(response.body.message).not.toContain(error.message);
    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(error);
  });
});
