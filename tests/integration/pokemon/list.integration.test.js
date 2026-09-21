import request from "supertest";
import app from "../../../backend/app.js";
import pokeApi from "../../../backend/src/clients/pokeapi.client.js";
import PokeApiError from "../../../backend/src/errors/poke-api.error.js";
import makePokemon from "../../factories/pokemon.factory.js";
import makePokemonCard from "../../factories/pokemon-card.factory.js";
import pokemonCache from "../../../backend/src/cache/pokemon.cache.js";
import { env } from "../../../config/env.js";

vi.mock("../../../backend/src/clients/pokeapi.client.js", () => ({
  default: vi.fn(),
}));

const listEndpoint = "pokemon?limit=500";
const bulbasaurUrl = "https://pokeapi.co/api/v2/pokemon/1/";
const ivysaurUrl = "https://pokeapi.co/api/v2/pokemon/2/";

describe("GET /pokemons", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    pokemonCache.flushAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return and cache mapped pokemon cards in the external result order", async () => {
    // Arrange
    const bulbasaur = makePokemon();
    const ivysaur = makePokemon({
      id: 2,
      name: "ivysaur",
      sprites: {
        front_default:
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
      },
    });

    const bulbasaurAndIvysaur = [
      makePokemonCard(),
      makePokemonCard({
        id: 2,
        name: "ivysaur",
        image:
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
      }),
    ];

    pokeApi
      .mockResolvedValueOnce({
        results: [{ url: bulbasaurUrl }, { url: ivysaurUrl }],
      })
      .mockResolvedValueOnce(bulbasaur)
      .mockResolvedValueOnce(ivysaur);

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(bulbasaurAndIvysaur);
    expect(pokeApi).toHaveBeenNthCalledWith(1, listEndpoint);
    expect(pokeApi).toHaveBeenCalledWith(bulbasaurUrl);
    expect(pokeApi).toHaveBeenCalledWith(ivysaurUrl);
    expect(pokemonCache.get(env.pokemonListCacheKey)).toStrictEqual(
      bulbasaurAndIvysaur,
    );
  });

  it("should return an empty list when PokeAPI has no results", async () => {
    // Arrange
    pokeApi.mockResolvedValueOnce({ results: [] });

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual([]);
    expect(pokeApi).toHaveBeenCalledExactlyOnceWith(listEndpoint);
  });

  it("should return 502 when the list request returns a PokeApiError", async () => {
    // Arrange
    pokeApi.mockRejectedValueOnce(
      new PokeApiError("PokeAPI responded with status 503"),
    );

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: "PokeAPI responded with status 503",
    });
  });

  it("should return 502 when an individual pokemon request returns a PokeApiError", async () => {
    // Arrange
    pokeApi
      .mockResolvedValueOnce({ results: [{ url: bulbasaurUrl }] })
      .mockRejectedValueOnce(
        new PokeApiError("PokeAPI responded with status 429"),
      );

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: "PokeAPI responded with status 429",
    });
  });

  it("should return 502 when the external list structure is invalid", async () => {
    // Arrange
    pokeApi.mockResolvedValueOnce({});

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: expect.stringContaining("results"),
    });
  });

  it("should return 502 when the external list contains a disallowed pokemon URL", async () => {
    // Arrange
    pokeApi.mockResolvedValueOnce({
      results: [{ url: "https://example.com/api/v2/pokemon/1/" }],
    });

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: expect.stringContaining("results.0.url"),
    });
    expect(pokeApi).toHaveBeenCalledExactlyOnceWith(listEndpoint);
  });

  it("should return 502 when an individual pokemon response is invalid", async () => {
    // Arrange
    pokeApi
      .mockResolvedValueOnce({ results: [{ url: bulbasaurUrl }] })
      .mockResolvedValueOnce(makePokemon({ id: "invalid-id" }));

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: expect.stringContaining("id"),
    });
  });

  it("should hide and log an unexpected failure from the list request", async () => {
    // Arrange
    const error = new TypeError("fetch failed");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    pokeApi.mockRejectedValueOnce(error);

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(500);
    expect(response.body).toStrictEqual({
      message: "internal server error",
    });
    expect(response.body.message).not.toContain(error.message);
    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("should hide and log an unexpected failure from an individual pokemon request", async () => {
    // Arrange
    const error = new TypeError("fetch failed");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    pokeApi
      .mockResolvedValueOnce({ results: [{ url: bulbasaurUrl }] })
      .mockRejectedValueOnce(error);

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(500);
    expect(response.body).toStrictEqual({
      message: "internal server error",
    });
    expect(response.body.message).not.toContain(error.message);
    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("should use the cache after the first request completes", async () => {
    //Arrange
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
        results: [
          { url: "https://pokeapi.co/api/v2/pokemon/1/" },
          { url: "https://pokeapi.co/api/v2/pokemon/2/" },
        ],
      })
      .mockResolvedValueOnce(bulbasaur)
      .mockResolvedValueOnce(ivysaur);

    //Act
    const firstResult = await request(app).get("/pokemons");

    const callsAfterFirstRequest = pokeApi.mock.calls.length;

    const secondResult = await request(app).get("/pokemons");

    //Assert
    expect(secondResult.body).toStrictEqual(firstResult.body);
    expect(pokeApi).toHaveBeenCalledTimes(callsAfterFirstRequest);
  });

  it("should return cached pokemons when cache has data", async () => {
    //Arrange
    const bulbasaur = makePokemon();

    const cachedPokemons = [makePokemonCard()];

    const consoleTimeSpy = vi
      .spyOn(console, "time")
      .mockImplementation(() => {});

    const consoleTimeEndSpy = vi
      .spyOn(console, "timeEnd")
      .mockImplementation(() => {});

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    pokeApi
      .mockResolvedValueOnce({
        results: [{ url: "https://pokeapi.co/api/v2/pokemon/1/" }],
      })
      .mockResolvedValueOnce(bulbasaur);

    //Act
    pokemonCache.set("pokemons:all", cachedPokemons);

    const result = await request(app).get("/pokemons");

    //Assert
    expect(result.body).toStrictEqual(cachedPokemons);
    expect(pokeApi).not.toHaveBeenCalled();
    expect(consoleTimeSpy).toHaveBeenCalled();
    expect(consoleTimeEndSpy).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledExactlyOnceWith("cache HIT");
  });

  it("should share the same operation between concurrent requests when the cache is empty", async () => {
    // Arrange
    let resolveListRequest;
    let pokeApiStarted;

    const pokeApiStartedPromise = new Promise((resolve) => {
      pokeApiStarted = resolve;
    });

    pokeApi.mockImplementation((path) => {
      if (path === "pokemon?limit=500") {
        pokeApiStarted();

        return new Promise((resolve) => {
          resolveListRequest = resolve;
        });
      }

      return Promise.resolve(makePokemon());
    });

    // Act
    const requests = Array.from({ length: 5 }, () =>
      request(app)
        .get("/pokemons")
        .then((response) => response.body),
    );

    await pokeApiStartedPromise;

    // Assert

    expect(pokeApi).toHaveBeenCalledOnce();

    resolveListRequest({
      results: [
        {
          url: bulbasaurUrl,
        },
      ],
    });

    const results = await Promise.all(requests);

    expect(results.flat()).toStrictEqual([
      makePokemonCard(),
      makePokemonCard(),
      makePokemonCard(),
      makePokemonCard(),
      makePokemonCard(),
    ]);
  });
});
