export default function makePokemon(overrides = {}) {
  return {
    id: 1,
    name: "bulbasaur",
    species: {
      url: "https://pokeapi.co/api/v2/pokemon-species/1/",
    },
    types: [
      {
        type: {
          name: "grass",
        },
      },
      {
        type: {
          name: "poison",
        },
      },
    ],
    sprites: {
      front_default:
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
    },
    height: 7,
    weight: 69,
    abilities: [
      {
        ability: {
          name: "overgrow",
        },
      },
      {
        ability: {
          name: "chlorophyll",
        },
      },
    ],
    stats: [
      {
        base_stat: 45,
        stat: { name: "hp" },
      },
      {
        base_stat: 49,
        stat: { name: "attack" },
      },
      {
        base_stat: 49,
        stat: { name: "defense" },
      },
      {
        base_stat: 65,
        stat: { name: "special-attack" },
      },
      {
        base_stat: 65,
        stat: { name: "special-defense" },
      },
      {
        base_stat: 45,
        stat: { name: "speed" },
      },
    ],
    ...overrides,
  };
}
