import mapPokemonTypes from "./pokemon-types.mapper.js";

export function mapPokemonDetails(pokemon, description) {
  return {
    name: pokemon.name,
    id: pokemon.id,
    types: mapPokemonTypes(pokemon.types),
    image: pokemon.sprites.front_default,
    description,
    height: pokemon.height,
    weight: pokemon.weight,
    abilities: pokemon.abilities.map(({ ability: { name } }) => name),
    stats: pokemon.stats.reduce((acc, { stat, base_stat }) => {
      acc[stat.name] = base_stat;

      return acc;
    }, {}),
  };
}

export function mapPokemonCard(pokemon) {
  return {
    name: pokemon.name,
    id: pokemon.id,
    types: mapPokemonTypes(pokemon.types),
    image: pokemon.sprites.front_default,
  };
}
