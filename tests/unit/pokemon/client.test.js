import pokeApi from "../../../backend/src/clients/pokeapi.client.js";
import PokeApiError from "../../../backend/src/errors/poke-api.error.js";
import makePokemon from "../../factories/pokemon.factory.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("pokeApi", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should request a relative PokeAPI path", async () => {
    // Arrange
    const data = makePokemon();
    const json = vi.fn().mockResolvedValue(data);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json,
    });

    // Act
    const result = await pokeApi("pokemon/1");

    // Assert
    expect(fetchSpy).toHaveBeenCalledOnce();

    const [url, options] = fetchSpy.mock.calls[0];

    console.log(fetchSpy.mock.calls);

    expect(url).toBeInstanceOf(URL);
    expect(url.toString()).toBe("https://pokeapi.co/api/v2/pokemon/1");
    expect(options.redirect).toBe("error");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(json).toHaveBeenCalledOnce();
    expect(result).toStrictEqual(data);
  });

  it("should create a 10-second abort signal for each request", async () => {
    // Arrange
    const signal = new AbortController().signal;
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    const absoluteUrl = "https://pokeapi.co/api/v2/pokemon/1";

    // Act
    await pokeApi("pokemon/1");

    // Assert
    expect(timeoutSpy).toHaveBeenCalledExactlyOnceWith(10_000);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        href: absoluteUrl,
      }),
      expect.objectContaining({ signal }),
    );
  });

  it("should request an allowed absolute PokeAPI URL", async () => {
    // Arrange
    const pokemon = makePokemon();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(pokemon),
    });
    const absoluteUrl = "https://pokeapi.co/api/v2/pokemon/1/";

    // Act
    const result = await pokeApi(absoluteUrl);

    // Assert
    const [url] = fetchSpy.mock.calls[0];
    expect(url.href).toBe(absoluteUrl);
    expect(result).toStrictEqual(pokemon);
  });

  it.each([
    ["a malformed URL", "http://[::1"],
    ["an external origin", "https://example.com/api/v2/pokemon/1"],
    ["a path outside /api/v2", "https://pokeapi.co/api/v1/pokemon/1"],
    [
      "an URL with credentials",
      "https://user:pass@pokeapi.co/api/v2/pokemon/1",
    ],
    ["a non-default port", "https://pokeapi.co:444/api/v2/pokemon/1"],
  ])("should reject %s", async (_, value) => {
    // Arrange
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // Act
    const promise = pokeApi(value);

    // Assert
    await expect(promise).rejects.toThrow(TypeError);
    await expect(promise).rejects.toThrow("PokeAPI URL is not allowed");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-string value", undefined],
    ["an empty value", "   "],
  ])("should reject %s before calling fetch", async (_, value) => {
    // Arrange
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // Act
    const promise = pokeApi(value);

    // Assert
    await expect(promise).rejects.toThrow(TypeError);
    await expect(promise).rejects.toThrow(
      "PokeAPI URL must be a non-empty string",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should throw PokeApiError when the HTTP response is unsuccessful", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    });

    // Act
    const promise = pokeApi("pokemon/1");

    // Assert
    await expect(promise).rejects.toBeInstanceOf(PokeApiError);
    await expect(promise).rejects.toThrow("PokeAPI responded with status 503");
  });

  it.each([
    ["a network error", new TypeError("fetch failed")],
    [
      "a timeout error",
      new DOMException("The request timed out", "TimeoutError"),
    ],
  ])("should propagate %s from fetch unchanged", async (_, error) => {
    //Arrange
    vi.spyOn(globalThis, "fetch").mockRejectedValue(error);

    //act
    const promise = pokeApi("pokemon/1");

    //Assert
    expect(promise).rejects.toBe(error);
  });

  it("should share the same request for concurrent calls", async () => {
    // Arrange
    const response = jsonResponse({
      id: 1,
      name: "bulbasaur",
    });

    fetchMock.mockResolvedValue(response);

    // Act
    const promises = Array.from({ length: 100 }, () => pokeApi("pokemon/1"));

    const results = await Promise.all(promises);

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(100);
  });
});
