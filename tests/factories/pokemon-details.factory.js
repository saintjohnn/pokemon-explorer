import makePokemonCard from "./pokemon-card.factory.js";

export default function makePokemonDetails(overrides = {}) {
  return {
    ...makePokemonCard(),
    description:
      "A strange seed was planted on its back at birth. The plant sprouts and grows with this POKéMON.",
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
    ...overrides,
  };
}
