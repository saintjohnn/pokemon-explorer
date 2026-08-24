import {
  mapPokemonCard,
  mapPokemonDetails,
} from "../../../backend/src/mappers/pokemon/pokemon.mapper.js";

import makePokemon from "../../factories/pokemon.factory.js";

describe("Pokemon mapper", () => {
  describe("mapPokemonCard", () => {
    it("should map pokemon card correctly", () => {
      //Arrange
      const pokemon = makePokemon();

      //Act
      const result = mapPokemonCard(pokemon);

      //Assert
      expect(result).toStrictEqual({
        id: 1,
        name: "bulbasaur",
        types: ["grass", "poison"],
        image:
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
      });
    });
  });

  describe("mapPokemonDetails", () => {
    it("should map pokemon details", () => {
      //Arrange
      const pokemon = makePokemon();

      const description =
        "A strange seed was planted on its back at birth.\fThe plant sprouts and grows with this POKéMON.";

      //Act
      const result = mapPokemonDetails(pokemon, description);

      //Assert
      expect(result).toStrictEqual({
        name: "bulbasaur",
        id: 1,
        types: ["grass", "poison"],
        image:
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
        description,
        height: 7,
        weight: 69,
        abilities: ["overgrow", "chlorophyll"],
        stats: {
          hp: 45,
          attack: 49,
          defense: 49,
          "special-attack": 65,
          "special-defense": 65,
          speed: 45,
        },
      });
    });
  });
});
