export default function makePokemonResults(overrides = {}) {
  return {
    results: [
      {
        url: "https://pokeapi.co/api/v2/pokemon/1/",
        ...overrides,
      },
    ],
  };
}
