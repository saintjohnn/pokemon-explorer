import { paramsSchema } from "../../../backend/src/schemas/params.schema.js";
import { paginationSchema } from "../../../backend/src/schemas/pagination.schema";
import {
  pokeApiPokemonCardResponseSchema,
  pokemonCardSchema,
  pokemonDetailsSchema,
  pokemonResultSchema,
  pokemonResponseSchema,
  pokemonSpeciesResponseSchema,
} from "../../../backend/src/schemas/pokemon.schema.js";
import makePokemon from "../../factories/pokemon.factory.js";
import makePokemonCard from "../../factories/pokemon-card.factory.js";
import makePokemonDetails from "../../factories/pokemon-details.factory.js";
import makePokemonSpecies from "../../factories/pokemon-species.factory.js";

const pokemonUrl = "https://pokeapi.co/api/v2/pokemon/1/";

const blankType = [
  {
    type: {
      name: "   ",
    },
  },
];

const blankAbility = [
  {
    ability: {
      name: "   ",
    },
  },
];

const blankStatName = [
  {
    base_stat: 45,
    stat: {
      name: "   ",
    },
  },
];

function expectInvalid(result, expectedPath) {
  expect(result.success).toBe(false);
  expect(result.error.issues[0].path).toStrictEqual(expectedPath);
}

describe("paramsSchema", () => {
  it("should transform a string containing digits into a number", () => {
    // Arrange
    const id = "25";

    // Act
    const result = paramsSchema.safeParse(id);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toBe(25);
  });

  it.each(["abc", "1.5", "-1", "", " 1 "])(
    "should reject an invalid id format: %j",
    (id) => {
      // Act
      const result = paramsSchema.safeParse(id);

      // Assert
      expect(result.success).toBe(false);
    },
  );

  it.each(["0", "501"])(
    "should parse an integer id without validating the service range: %s",
    (id) => {
      // Act
      const result = paramsSchema.safeParse(id);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBe(Number(id));
    },
  );
});

describe.each([
  ["pokemonCardSchema", pokemonCardSchema, makePokemonCard],
  ["pokemonDetailsSchema", pokemonDetailsSchema, makePokemonDetails],
])("%s shared card fields", (_, schema, factory) => {
  it("should accept valid data", () => {
    // Arrange
    const pokemon = factory();

    // Act
    const result = schema.safeParse(pokemon);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(pokemon);
  });

  it("should accept a null image", () => {
    // Arrange
    const pokemon = factory({ image: null });

    // Act
    const result = schema.safeParse(pokemon);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(pokemon);
  });

  it.each([
    ["a non-positive id", { id: 0 }, ["id"]],
    ["a non-integer id", { id: 1.5 }, ["id"]],
    ["a blank name", { name: "   " }, ["name"]],
    ["no types", { types: [] }, ["types"]],
    ["a blank type name", { types: ["   "] }, ["types", 0]],
    [
      "a non-HTTP image URL",
      { image: "data:image/svg+xml,<svg></svg>" },
      ["image"],
    ],
  ])("should reject %s", (_, overrides, expectedPath) => {
    // Arrange
    const pokemon = factory(overrides);

    // Act
    const result = schema.safeParse(pokemon);

    // Assert
    expectInvalid(result, expectedPath);
  });
});

describe("pokemonDetailsSchema specific fields", () => {
  it.each([
    ["a blank description", { description: "   " }, ["description"]],
    ["a non-positive height", { height: 0 }, ["height"]],
    ["a non-integer height", { height: 7.5 }, ["height"]],
    ["a non-positive weight", { weight: 0 }, ["weight"]],
    ["a non-integer weight", { weight: 69.5 }, ["weight"]],
    ["no abilities", { abilities: [] }, ["abilities"]],
    ["a blank ability name", { abilities: ["   "] }, ["abilities", 0]],
    ["no stats", { stats: {} }, ["stats"]],
    ["a negative stat", { stats: { hp: -1 } }, ["stats", "hp"]],
  ])("should reject pokemon details with %s", (_, overrides, expectedPath) => {
    // Arrange
    const pokemonDetails = makePokemonDetails(overrides);

    // Act
    const result = pokemonDetailsSchema.safeParse(pokemonDetails);

    // Assert
    expectInvalid(result, expectedPath);
  });
});

describe("paginationSchema", () => {
  it("should apply default limit and offset when query parameters are absent", () => {
    //Arrange

    //Act
    const result = paginationSchema.safeParse({});

    //Assert
    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual({ limit: 50, offset: 0 });
  });

  it("should transform limit and offset query strings into integers", () => {
    //Arrange

    //Act
    const result = paginationSchema.safeParse({ limit: "25", offset: "50" });

    //Assert
    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual({ limit: 25, offset: 50 });
  });

  it("should allow a limit greater than 500", () => {
    //Arrange

    //Act
    const result = paginationSchema.safeParse({ limit: "501", offset: "0" });

    //Assert
    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual({ limit: 501, offset: 0 });
  });

  it.each([
    ["limit", "0", ["limit"]],
    ["limit", "-1", ["limit"]],
    ["limit", "1.5", ["limit"]],
    ["limit", "abc", ["limit"]],
    ["offset", "-1", ["offset"]],
    ["offset", "1.5", ["offset"]],
    ["offset", "abc", ["offset"]],
  ])("should reject an invalid %s value: %s", (field, value, expectedPath) => {
    //Act
    const result = paginationSchema.safeParse({ [field]: value });

    //Assert
    expectInvalid(result, expectedPath);
  });

  it("should reject an array value instead of a single query parameter", () => {
    //Arrange

    //Act
    const result = paginationSchema.safeParse({ limit: ["10", "20"] });

    //Assert
    expectInvalid(result, ["limit"]);
  });
});

describe("pokemonResultSchema", () => {
  it.each([
    [
      "a valid pokemon result list",
      {
        count: 1302,
        results: [
          { url: pokemonUrl },
          {
            url: "https://pokeapi.co/api/v2/pokemon/2/",
          },
        ],
      },
    ],
    ["an empty result list", { count: 1302, results: [] }],
  ])("should accept %s", (_, response) => {
    // Act
    const result = pokemonResultSchema.safeParse(response);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(response);
  });

  it("should reject a missing count", () => {
    //Arrange

    //Act
    const result = pokemonResultSchema.safeParse({ results: [] });

    //Assert
    expectInvalid(result, ["count"]);
  });

  it.each([
    ["zero", 0],
    ["a negative number", -1],
    ["a non-integer", 1.5],
    ["a string", "1302"],
  ])("should reject count when it is %s", (_, count) => {
    //Act
    const result = pokemonResultSchema.safeParse({ count, results: [] });

    //Assert
    expectInvalid(result, ["count"]);
  });

  it.each([
    ["a malformed URL", "invalid-url"],
    [
      "a URL outside the PokeAPI origin",
      "https://example.com/api/v2/pokemon/1/",
    ],
  ])("should reject %s", (_, url) => {
    // Arrange
    const response = {
      count: 1,
      results: [{ url }],
    };

    // Act
    const result = pokemonResultSchema.safeParse(response);

    // Assert
    expectInvalid(result, ["results", 0, "url"]);
  });
});

describe.each([
  ["pokemonResponseSchema", pokemonResponseSchema],
  ["pokeApiPokemonCardResponseSchema", pokeApiPokemonCardResponseSchema],
])("%s shared PokeAPI fields", (_, schema) => {
  it("should accept a null sprite", () => {
    // Arrange
    const pokemon = makePokemon({
      sprites: {
        front_default: null,
      },
    });

    // Act
    const result = schema.safeParse(pokemon);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.sprites.front_default).toBeNull();
  });

  it.each([
    ["a non-positive id", { id: 0 }, ["id"]],
    ["a non-integer id", { id: 1.5 }, ["id"]],
    ["a blank name", { name: "   " }, ["name"]],
    ["no types", { types: [] }, ["types"]],
    ["a blank type name", { types: blankType }, ["types", 0, "type", "name"]],
    [
      "a non-HTTP sprite URL",
      {
        sprites: {
          front_default: "data:image/svg+xml,<svg></svg>",
        },
      },
      ["sprites", "front_default"],
    ],
  ])("should reject %s", (_, overrides, expectedPath) => {
    // Arrange
    const pokemon = makePokemon(overrides);

    // Act
    const result = schema.safeParse(pokemon);

    // Assert
    expectInvalid(result, expectedPath);
  });
});

describe("pokemonResponseSchema specific fields", () => {
  it("should accept a valid pokemon response", () => {
    // Arrange
    const pokemon = makePokemon();

    // Act
    const result = pokemonResponseSchema.safeParse(pokemon);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(pokemon);
  });

  it.each([
    [
      "a species URL outside the PokeAPI origin",
      {
        species: {
          url: "http://localhost:3000/private",
        },
      },
      ["species", "url"],
    ],
    ["a non-positive height", { height: 0 }, ["height"]],
    ["a non-positive weight", { weight: 0 }, ["weight"]],
    ["no abilities", { abilities: [] }, ["abilities"]],
    [
      "a blank ability name",
      { abilities: blankAbility },
      ["abilities", 0, "ability", "name"],
    ],
    ["no stats", { stats: [] }, ["stats"]],
    [
      "a negative base stat",
      {
        stats: [
          {
            base_stat: -1,
            stat: {
              name: "hp",
            },
          },
        ],
      },
      ["stats", 0, "base_stat"],
    ],
    [
      "a blank stat name",
      { stats: blankStatName },
      ["stats", 0, "stat", "name"],
    ],
  ])(
    "should reject a pokemon response with %s",
    (_, overrides, expectedPath) => {
      // Arrange
      const pokemon = makePokemon(overrides);

      // Act
      const result = pokemonResponseSchema.safeParse(pokemon);

      // Assert
      expectInvalid(result, expectedPath);
    },
  );
});

describe("pokemonSpeciesResponseSchema", () => {
  it("should accept a valid species response", () => {
    // Arrange
    const species = makePokemonSpecies();

    // Act
    const result = pokemonSpeciesResponseSchema.safeParse(species);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(species);
  });

  it("should accept an empty flavor text entry list", () => {
    // Arrange
    const species = {
      flavor_text_entries: [],
    };

    // Act
    const result = pokemonSpeciesResponseSchema.safeParse(species);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(species);
  });

  it("should reject flavor_text_entries when it is not an array", () => {
    // Arrange
    const species = {
      flavor_text_entries: "invalid",
    };

    // Act
    const result = pokemonSpeciesResponseSchema.safeParse(species);

    // Assert
    expectInvalid(result, ["flavor_text_entries"]);
  });

  it("should accept a structurally valid response without english text", () => {
    // Arrange
    const species = makePokemonSpecies({
      name: "pt",
    });

    // Act
    const result = pokemonSpeciesResponseSchema.safeParse(species);

    // Assert
    expect(result.success).toBe(true);
  });

  it.each([
    [
      "a blank flavor text",
      makePokemonSpecies({
        flavorText: "   ",
      }),
      ["flavor_text_entries", 0, "flavor_text"],
    ],
    [
      "a blank language name",
      makePokemonSpecies({
        name: "   ",
      }),
      ["flavor_text_entries", 0, "language", "name"],
    ],
  ])("should reject a species response with %s", (_, species, expectedPath) => {
    // Act
    const result = pokemonSpeciesResponseSchema.safeParse(species);

    // Assert
    expectInvalid(result, expectedPath);
  });
});

describe("pokeApiPokemonCardResponseSchema specific behavior", () => {
  it("should accept a valid response and strip unused fields", () => {
    // Arrange
    const pokemon = makePokemon();

    // Act
    const result = pokeApiPokemonCardResponseSchema.safeParse(pokemon);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual({
      id: pokemon.id,
      name: pokemon.name,
      types: pokemon.types,
      sprites: pokemon.sprites,
    });
  });
});
