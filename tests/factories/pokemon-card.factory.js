export default function makePokemonCard(overrides = {}) {
  return {
    id: 1,
    name: "bulbasaur",
    types: ["grass", "poison"],
    image:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
    ...overrides,
  };
}
