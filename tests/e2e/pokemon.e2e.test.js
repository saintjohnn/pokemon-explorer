import request from "supertest";
import app from "../../backend/app.js";
import makePokemon from "../factories/pokemon.factory.js";
import makePokemonCard from "../factories/pokemon-card.factory.js";
import makePokemonDetails from "../factories/pokemon-details.factory.js";
import makePokemonResults from "../factories/pokemon-results.factory.js";
import makePokemonSpecies from "../factories/pokemon-species.factory.js";
import pokemonCache from "../../backend/src/cache/pokemon.cache";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("Pokemon API end-to-end behavior", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    pokemonCache.flushAll();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return pokemon cards through the complete application flow", async () => {
    // Arrange
    const results = makePokemonResults();
    const pokemon = makePokemon();

    fetchMock
      .mockResolvedValueOnce(jsonResponse(results))
      .mockResolvedValueOnce(jsonResponse(pokemon));

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual([makePokemonCard()]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [listUrl, listOptions] = fetchMock.mock.calls[0];
    const [pokemonUrl, pokemonOptions] = fetchMock.mock.calls[1];

    expect(listUrl.toString()).toBe(
      "https://pokeapi.co/api/v2/pokemon?limit=500",
    );
    expect(pokemonUrl.toString()).toBe(results.results[0].url);
    expect(listOptions).toMatchObject({ redirect: "error" });
    expect(pokemonOptions).toMatchObject({ redirect: "error" });
    expect(listOptions.signal).toBeInstanceOf(AbortSignal);
    expect(pokemonOptions.signal).toBeInstanceOf(AbortSignal);
  });

  it("should return pokemon details through the complete application flow", async () => {
    // Arrange
    const pokemon = makePokemon();
    const species = makePokemonSpecies();

    fetchMock
      .mockResolvedValueOnce(jsonResponse(pokemon))
      .mockResolvedValueOnce(jsonResponse(species));

    // Act
    const response = await request(app).get("/pokemons/1");

    console.log(fetchMock.mock.calls);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(makePokemonDetails());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://pokeapi.co/api/v2/pokemon/1",
    );
    expect(fetchMock.mock.calls[1][0].toString()).toBe(pokemon.species.url);
  });

  it("should translate an unsuccessful PokeAPI response to 502", async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: true }, 503));

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body).toStrictEqual({
      message: "PokeAPI responded with status 503",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("should reject an invalid external response after using the real client", async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [{ url: "https://example.com/api/v2/pokemon/1/" }],
      }),
    );

    // Act
    const response = await request(app).get("/pokemons");

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.body.message).toContain("results.0.url");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
