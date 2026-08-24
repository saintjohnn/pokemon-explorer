import {
  createPokeApiUrl,
  isAllowedPokeApiUrl,
} from "../../../backend/src/utils/pokeapi-url.js";

describe("PokeAPI URL utilities", () => {
  describe("isAllowedPokeApiUrl", () => {
    it.each([
      "https://pokeapi.co/api/v2/pokemon/1/",
      "https://pokeapi.co/api/v2/pokemon-species/1/",
      "https://pokeapi.co/api/v2/pokemon?limit=500",
    ])("should accept an allowed absolute PokeAPI URL: %s", (value) => {
      expect(isAllowedPokeApiUrl(value)).toBe(true);
    });

    it.each([
      ["an invalid URL", "not-a-url"],
      ["a malformed URL", "http://[::1"],
      ["a relative URL", "pokemon/1"],
      ["another origin", "https://example.com/api/v2/pokemon/1/"],
      ["HTTP instead of HTTPS", "http://pokeapi.co/api/v2/pokemon/1/"],
      ["a non-default port", "https://pokeapi.co:444/api/v2/pokemon/1/"],
      ["a path outside API v2", "https://pokeapi.co/api/v1/pokemon/1/"],
      [
        "an encoded path traversal outside API v2",
        "https://pokeapi.co/api/v2/%2e%2e/private",
      ],
      ["a similar path prefix", "https://pokeapi.co/api/v20/pokemon/1/"],
      [
        "embedded credentials",
        "https://user:pass@pokeapi.co/api/v2/pokemon/1/",
      ],
    ])("should reject %s", (_, value) => {
      expect(isAllowedPokeApiUrl(value)).toBe(false);
    });

    it.each([
      undefined,
      null,
      25,
      {},
      [],
      new URL("https://pokeapi.co/api/v2/pokemon/1/"),
      "",
      "   ",
    ])("should reject a non-string or empty value: %j", (value) => {
      expect(isAllowedPokeApiUrl(value)).toBe(false);
    });
  });

  describe("createPokeApiUrl", () => {
    it.each([
      ["pokemon/25", "https://pokeapi.co/api/v2/pokemon/25"],
      ["not-a-url", "https://pokeapi.co/api/v2/not-a-url"],
      ["pokemon?limit=500", "https://pokeapi.co/api/v2/pokemon?limit=500"],
      ["/api/v2/pokemon/25", "https://pokeapi.co/api/v2/pokemon/25"],
    ])("should resolve %s against the PokeAPI base URL", (value, expected) => {
      const url = createPokeApiUrl(value);

      expect(url).toBeInstanceOf(URL);
      expect(url.href).toBe(expected);
    });

    it("should preserve an allowed absolute URL", () => {
      const value = "https://pokeapi.co/api/v2/pokemon/25/";

      expect(createPokeApiUrl(value).href).toBe(value);
    });

    it.each([undefined, null, 25, {}, [], "", "   "])(
      "should reject an empty or non-string value: %j",
      (value) => {
        const createUrl = () => createPokeApiUrl(value);

        expect(createUrl).toThrow(TypeError);
        expect(createUrl).toThrow("PokeAPI URL must be a non-empty string");
      },
    );

    it.each([
      "http://[::1",
      "https://example.com/api/v2/pokemon/1/",
      "//example.com/api/v2/pokemon/1/",
      "http://pokeapi.co/api/v2/pokemon/1/",
      "https://pokeapi.co:444/api/v2/pokemon/1/",
      "https://pokeapi.co/api/v1/pokemon/1/",
      "https://pokeapi.co/api/v20/pokemon/1/",
      "https://user:pass@pokeapi.co/api/v2/pokemon/1/",
      "../pokemon/1",
      "%2e%2e/pokemon/1",
    ])("should reject an invalid or disallowed URL: %s", (value) => {
      const createUrl = () => createPokeApiUrl(value);

      expect(createUrl).toThrow(TypeError);

      expect(createUrl).toThrow("PokeAPI URL is not allowed");
    });
  });
});
