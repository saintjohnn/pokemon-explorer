import mapPokemonTypes from "../../../backend/src/mappers/pokemon/pokemon-types.mapper.js";

describe("mapPokemonTypes", () => {
  it("should extract type names preserving their order", () => {
    const types = [{ type: { name: "grass" } }, { type: { name: "poison" } }];

    expect(mapPokemonTypes(types)).toStrictEqual(["grass", "poison"]);
  });

  it("should return an empty array for an empty input", () => {
    expect(mapPokemonTypes([])).toStrictEqual([]);
  });
});
