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

const defaultListEndpoint = "pokemon?limit=50&offset=0";
const bulbasaurUrl = "https://pokeapi.co/api/v2/pokemon/1/";
const ivysaurUrl = "https://pokeapi.co/api/v2/pokemon/2/";

function cachedPageKey(limit, offset) {
  return `${env.pokemonListCacheKey}:limit=${limit}:offset=${offset}`;
}

describe("GET /pokemons", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    pokemonCache.flushAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return count and mapped pokemon cards for the default page", async () => {
    const bulbasaur = makePokemon();
    const ivysaur = makePokemon({
      id: 2,
      name: "ivysaur",
      sprites: {
        front_default:
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
      },
    });
    const expected = {
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
    };

    pokeApi
      .mockResolvedValueOnce({
        count: 1302,
        results: [{ url: bulbasaurUrl }, { url: ivysaurUrl }],
      })
      .mockResolvedValueOnce(bulbasaur)
      .mockResolvedValueOnce(ivysaur);

    const response = await request(app).get("/pokemons");

    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(expected);
    expect(pokeApi).toHaveBeenNthCalledWith(1, defaultListEndpoint);
    expect(pokemonCache.get(cachedPageKey(50, 0))).toStrictEqual(expected);
  });

  it("should forward custom limit and offset to PokeAPI and return count", async () => {
    const pokemon = makePokemon();
    const expected = { count: 1302, results: [makePokemonCard()] };

    pokeApi
      .mockResolvedValueOnce({ count: 1302, results: [{ url: bulbasaurUrl }] })
      .mockResolvedValueOnce(pokemon);

    const response = await request(app)
      .get("/pokemons")
      .query({ limit: 25, offset: 50 });

    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(expected);
    expect(pokeApi).toHaveBeenNthCalledWith(1, "pokemon?limit=25&offset=50");
    expect(pokemonCache.get(cachedPageKey(25, 50))).toStrictEqual(expected);
  });

  it("should accept a limit greater than 500", async () => {
    pokeApi.mockResolvedValueOnce({ count: 1000, results: [] });

    const response = await request(app).get("/pokemons?limit=501&offset=0");

    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual({ count: 1000, results: [] });
    expect(pokeApi).toHaveBeenCalledExactlyOnceWith(
      "pokemon?limit=501&offset=0",
    );
  });

  it.each([
    ["limit", "0"],
    ["limit", "abc"],
    ["offset", "-1"],
    ["offset", "1.5"],
  ])("should return 400 for an invalid %s value", async (field, value) => {
    const response = await request(app)
      .get("/pokemons")
      .query({ [field]: value });

    expect(response.statusCode).toBe(400);
    expect(response.body).toStrictEqual({
      message: "Invalid pagination parameters",
    });
    expect(pokeApi).not.toHaveBeenCalled();
  });

  it("should return an empty page while preserving the total count", async () => {
    pokeApi.mockResolvedValueOnce({ count: 1302, results: [] });

    const response = await request(app).get("/pokemons?limit=50&offset=1300");

    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual({ count: 1302, results: [] });
  });

  it("should reject an external list response without count", async () => {
    pokeApi.mockResolvedValueOnce({ results: [] });

    const response = await request(app).get("/pokemons");

    expect(response.statusCode).toBe(502);
    expect(response.body.message).toContain("count");
  });

  it("should use a separate cache entry for different pages", async () => {
    const bulbasaur = makePokemon();
    const ivysaur = makePokemon({ id: 2, name: "ivysaur" });

    pokeApi
      .mockResolvedValueOnce({ count: 1302, results: [{ url: bulbasaurUrl }] })
      .mockResolvedValueOnce(bulbasaur)
      .mockResolvedValueOnce({ count: 1302, results: [{ url: ivysaurUrl }] })
      .mockResolvedValueOnce(ivysaur);

    const first = await request(app).get("/pokemons?limit=25&offset=0");
    const second = await request(app).get("/pokemons?limit=25&offset=25");
    const firstAgain = await request(app).get("/pokemons?limit=25&offset=0");

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(firstAgain.statusCode).toBe(200);
    expect(firstAgain.body).toStrictEqual(first.body);
    expect(pokeApi).toHaveBeenCalledTimes(4);
  });

  it("should return 502 when the list request returns a PokeApiError", async () => {
    pokeApi.mockRejectedValueOnce(
      new PokeApiError("PokeAPI responded with status 503"),
    );

    const response = await request(app).get("/pokemons");

    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: "PokeAPI responded with status 503",
    });
  });

  it("should return 502 when an individual pokemon request returns a PokeApiError", async () => {
    pokeApi
      .mockResolvedValueOnce({ count: 1, results: [{ url: bulbasaurUrl }] })
      .mockRejectedValueOnce(
        new PokeApiError("PokeAPI responded with status 429"),
      );

    const response = await request(app).get("/pokemons");

    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: "PokeAPI responded with status 429",
    });
  });

  it("should return 502 when the external list structure is invalid", async () => {
    pokeApi.mockResolvedValueOnce({});

    const response = await request(app).get("/pokemons");

    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: expect.stringContaining("count"),
    });
  });

  it("should return 502 when the external list contains a disallowed pokemon URL", async () => {
    pokeApi.mockResolvedValueOnce({
      count: 1,
      results: [{ url: "https://example.com/api/v2/pokemon/1/" }],
    });

    const response = await request(app).get("/pokemons");

    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: expect.stringContaining("results.0.url"),
    });
    expect(pokeApi).toHaveBeenCalledExactlyOnceWith(defaultListEndpoint);
  });

  it("should return 502 when an individual pokemon response is invalid", async () => {
    pokeApi
      .mockResolvedValueOnce({ count: 1, results: [{ url: bulbasaurUrl }] })
      .mockResolvedValueOnce(makePokemon({ id: "invalid-id" }));

    const response = await request(app).get("/pokemons");

    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: expect.stringContaining("id"),
    });
  });

  it("should hide and log an unexpected failure from the list request", async () => {
    const error = new TypeError("fetch failed");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    pokeApi.mockRejectedValueOnce(error);

    const response = await request(app).get("/pokemons");

    expect(response.statusCode).toBe(500);
    expect(response.body).toStrictEqual({ message: "internal server error" });
    expect(response.body.message).not.toContain(error.message);
    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("should hide and log an unexpected failure from an individual pokemon request", async () => {
    const error = new TypeError("fetch failed");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    pokeApi
      .mockResolvedValueOnce({ count: 1, results: [{ url: bulbasaurUrl }] })
      .mockRejectedValueOnce(error);

    const response = await request(app).get("/pokemons");

    expect(response.statusCode).toBe(500);
    expect(response.body).toStrictEqual({ message: "internal server error" });
    expect(response.body.message).not.toContain(error.message);
    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("should use the cache after the first request completes", async () => {
    const bulbasaur = makePokemon();
    pokeApi
      .mockResolvedValueOnce({ count: 1, results: [{ url: bulbasaurUrl }] })
      .mockResolvedValueOnce(bulbasaur);

    const firstResult = await request(app).get("/pokemons");
    const callsAfterFirstRequest = pokeApi.mock.calls.length;
    const secondResult = await request(app).get("/pokemons");

    expect(firstResult.statusCode).toBe(200);
    expect(secondResult.statusCode).toBe(200);
    expect(secondResult.body).toStrictEqual(firstResult.body);
    expect(pokeApi).toHaveBeenCalledTimes(callsAfterFirstRequest);
  });

  it("should return cached paginated data without calling PokeAPI", async () => {
    const cachedPage = { count: 1302, results: [makePokemonCard()] };
    pokemonCache.set(cachedPageKey(25, 50), cachedPage);

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const response = await request(app).get("/pokemons?limit=25&offset=50");

    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(cachedPage);
    expect(pokeApi).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledExactlyOnceWith("cache HIT");
  });

  it("should share the same operation between concurrent requests for the same page", async () => {
    let resolveListRequest;
    let pokeApiStarted;

    const pokeApiStartedPromise = new Promise((resolve) => {
      pokeApiStarted = resolve;
    });

    pokeApi.mockImplementation((path) => {
      if (path === defaultListEndpoint) {
        pokeApiStarted();
        return new Promise((resolve) => {
          resolveListRequest = resolve;
        });
      }

      return Promise.resolve(makePokemon());
    });

    const requests = Array.from({ length: 5 }, () =>
      request(app)
        .get("/pokemons")
        .then((response) => response.body),
    );

    await pokeApiStartedPromise;
    expect(pokeApi).toHaveBeenCalledOnce();

    resolveListRequest({
      count: 1,
      results: [{ url: bulbasaurUrl }],
    });

    const results = await Promise.all(requests);
    expect(results).toHaveLength(5);
    expect(results.every((result) => result.count === 1)).toBe(true);
    expect(results.every((result) => result.results.length === 1)).toBe(true);
    expect(pokeApi).toHaveBeenCalledTimes(2);
  });
});
